import 'server-only';

// ============================================================
// Lector de estados de cuenta (PDF) con Claude
// ------------------------------------------------------------
// Extrae el resumen del estado de cuenta (fechas de corte/pago,
// saldos, pago mínimo, pago para no generar intereses) y la lista
// de movimientos, clasificando cada uno por tipo y categoría.
// ============================================================

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export const CATEGORIES = [
    'comida',                 // restaurantes, cafés, comida a domicilio
    'supermercado',           // despensa, abarrotes
    'gasolina',
    'transporte',             // uber/taxi, estacionamiento, casetas
    'servicios',              // luz, agua, teléfono, internet, suscripciones
    'salud',                  // farmacia, doctores, hospitales
    'entretenimiento',        // cine, streaming, bares
    'compras',                // tiendas, ropa, electrónica, amazon
    'viajes',                 // hoteles, vuelos
    'educacion',
    'pagos a terceros',       // transferencias salientes a personas
    'ingresos de terceros',   // transferencias/depósitos recibidos
    'pago de tarjeta',        // pago que abonas a la tarjeta de crédito
    'intereses y comisiones',
    'efectivo',               // retiros / disposición de efectivo
    'otros',
] as const;

export type StatementTx = {
    date?: string;            // ISO YYYY-MM-DD
    description: string;
    amount: number;           // siempre positivo, MXN
    type: 'expense' | 'income' | 'payment';
    category: string;
};

export type ParsedStatement = {
    bank?: string;
    account_type?: 'credit' | 'debit';
    last4?: string;
    period_label?: string;
    statement_date?: string;       // fecha de corte (ISO)
    due_date?: string;             // fecha límite de pago (ISO)
    previous_balance?: number;
    new_balance?: number;          // saldo / deuda al corte
    minimum_payment?: number;
    no_interest_payment?: number;  // pago para no generar intereses
    credit_limit?: number;
    total_income?: number;
    total_expense?: number;
    transactions: StatementTx[];
    notes?: string;
};

const SYSTEM = `Eres un analista financiero que lee estados de cuenta bancarios mexicanos (tarjetas de crédito y débito) en PDF y los convierte en datos estructurados. El documento puede ser de cualquier banco (BBVA, Banorte, Santander, Banamex, HSBC, American Express, etc.). Todos los montos están en pesos mexicanos (MXN).

Tu trabajo:
1) Identificar el resumen del estado de cuenta:
   - bank: nombre del banco/emisor.
   - account_type: "credit" si es tarjeta de crédito, "debit" si es débito/cuenta.
   - last4: últimos 4 dígitos de la tarjeta si aparecen.
   - statement_date: fecha de corte (ISO YYYY-MM-DD).
   - due_date: fecha límite de pago (ISO YYYY-MM-DD).
   - previous_balance: saldo anterior.
   - new_balance: saldo nuevo / deuda total al corte (para crédito) o saldo final (para débito).
   - minimum_payment: pago mínimo.
   - no_interest_payment: pago para no generar intereses (a veces "pago para no generar intereses" o "saldo a la fecha de corte").
   - credit_limit: línea de crédito.
   - period_label: etiqueta legible del periodo, ej. "Junio 2026".

2) Extraer TODOS los movimientos del periodo. Para cada uno:
   - date: fecha del cargo/abono (ISO YYYY-MM-DD; usa el año del periodo).
   - description: descripción tal cual aparece (comercio o concepto).
   - amount: monto en positivo (sin signo).
   - type: "expense" para cargos/compras/comisiones; "income" para depósitos/abonos recibidos (ingresos de terceros, nómina, devoluciones); "payment" SOLO para el pago que se abona a la tarjeta de crédito ("su pago", "pago recibido", "gracias por su pago").
   - category: una de EXACTAMENTE estas: ${CATEGORIES.join(', ')}.

Reglas de clasificación:
- "pago de tarjeta" + type "payment" cuando es el abono que reduce la deuda de la tarjeta.
- "ingresos de terceros" + type "income" para transferencias/depósitos recibidos de personas.
- "pagos a terceros" para transferencias salientes a personas.
- Si dudas de la categoría, usa "otros".
- No inventes movimientos. Si el PDF no es un estado de cuenta, devuelve transactions vacío y explica en notes.

Responde ÚNICAMENTE con JSON válido (sin texto adicional ni markdown), con esta forma:
{
  "bank": string,
  "account_type": "credit" | "debit",
  "last4": string,
  "period_label": string,
  "statement_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "previous_balance": number,
  "new_balance": number,
  "minimum_payment": number,
  "no_interest_payment": number,
  "credit_limit": number,
  "total_income": number,
  "total_expense": number,
  "transactions": [ { "date": "YYYY-MM-DD", "description": string, "amount": number, "type": "expense"|"income"|"payment", "category": string } ],
  "notes": string
}
Omite las llaves de resumen que no encuentres.`;

export async function parseStatement(pdfBase64: string): Promise<ParsedStatement> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está definida');

    const res = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 8000,
            system: SYSTEM,
            messages: [{
                role: 'user',
                content: [
                    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
                    { type: 'text', text: 'Extrae el resumen y todos los movimientos clasificados de este estado de cuenta. Devuelve solo el JSON.' },
                ],
            }],
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Claude falló (${res.status}): ${errText.slice(0, 400)}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('La IA no devolvió JSON analizable.');

    let parsed: ParsedStatement;
    try {
        parsed = JSON.parse(jsonMatch[0]) as ParsedStatement;
    } catch {
        throw new Error('La IA devolvió un JSON inválido.');
    }
    if (!Array.isArray(parsed.transactions)) parsed.transactions = [];

    // Normaliza montos a positivos y recalcula totales si faltan
    let inc = 0, exp = 0;
    for (const t of parsed.transactions) {
        t.amount = Math.abs(Number(t.amount) || 0);
        if (t.type === 'income') inc += t.amount;
        else if (t.type === 'expense') exp += t.amount;
    }
    if (parsed.total_income == null) parsed.total_income = Number(inc.toFixed(2));
    if (parsed.total_expense == null) parsed.total_expense = Number(exp.toFixed(2));

    return parsed;
}
