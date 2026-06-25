import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/emailSync';
import { parseStatement } from '@/lib/parseStatement';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min en Vercel

export async function POST(req: NextRequest) {
    let body: { fileUrl?: string; fileName?: string; accountId?: string | null };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
    }

    const { fileUrl, fileName } = body;
    let accountId = body.accountId || null;
    if (!fileUrl) {
        return NextResponse.json({ ok: false, error: 'Falta fileUrl' }, { status: 400 });
    }

    try {
        // 1) Descarga el PDF desde Storage y conviértelo a base64
        const pdfRes = await fetch(fileUrl);
        if (!pdfRes.ok) throw new Error(`No se pudo descargar el PDF (${pdfRes.status})`);
        const buf = Buffer.from(await pdfRes.arrayBuffer());
        const pdfBase64 = buf.toString('base64');

        // 2) IA: parsea y clasifica
        const parsed = await parseStatement(pdfBase64);

        const supabase = getServerSupabase();

        // 3) Resuelve la tarjeta: usa la elegida, o detéctala por últimos 4 / banco, o créala
        let accountName: string | null = null;
        let accountCreated = false;
        const last4 = (parsed.last4 || '').trim() || null;
        const bank = (parsed.bank || '').trim() || null;
        const type = parsed.account_type === 'debit' ? 'debit' : 'credit';

        if (!accountId) {
            // Intenta emparejar con una tarjeta existente
            let match: { id: string; name: string } | null = null;
            if (last4) {
                const { data } = await supabase.from('financial_accounts').select('id, name').eq('last4', last4).limit(1);
                if (data && data.length) match = data[0] as any;
            }
            if (!match && bank) {
                const { data } = await supabase.from('financial_accounts').select('id, name').ilike('bank', bank).limit(1);
                if (data && data.length) match = data[0] as any;
            }
            if (match) {
                accountId = match.id;
                accountName = match.name;
            } else {
                // Crea la tarjeta detectada
                const name = bank ? `${bank}${last4 ? ` ••${last4}` : ''}` : (last4 ? `Tarjeta ••${last4}` : 'Tarjeta sin identificar');
                const { data: created, error: cErr } = await supabase
                    .from('financial_accounts')
                    .insert({ name, type, bank, last4, credit_limit: parsed.credit_limit ?? null })
                    .select('id, name')
                    .single();
                if (cErr) throw new Error(`No se pudo crear la tarjeta detectada: ${cErr.message}`);
                accountId = created!.id as string;
                accountName = created!.name as string;
                accountCreated = true;
            }
        } else {
            const { data } = await supabase.from('financial_accounts').select('name').eq('id', accountId).single();
            accountName = (data?.name as string) || null;
        }

        // 4) Guarda el estado de cuenta + movimientos
        const { data: stmt, error: sErr } = await supabase
            .from('bank_statements')
            .insert({
                account_id: accountId,
                period_label: parsed.period_label || null,
                statement_date: parsed.statement_date || null,
                due_date: parsed.due_date || null,
                previous_balance: parsed.previous_balance ?? null,
                new_balance: parsed.new_balance ?? null,
                minimum_payment: parsed.minimum_payment ?? null,
                no_interest_payment: parsed.no_interest_payment ?? null,
                credit_limit: parsed.credit_limit ?? null,
                total_income: parsed.total_income ?? null,
                total_expense: parsed.total_expense ?? null,
                bank: parsed.bank || null,
                last4: parsed.last4 || null,
                file_url: fileUrl,
                file_name: fileName || null,
                raw: parsed,
            })
            .select('id')
            .single();
        if (sErr) throw new Error(`No se pudo guardar el estado de cuenta: ${sErr.message}`);

        const statementId = stmt!.id as string;

        if (parsed.transactions.length) {
            const rows = parsed.transactions.map(t => ({
                statement_id: statementId,
                account_id: accountId,
                tx_date: t.date || null,
                description: t.description || null,
                amount: Math.abs(Number(t.amount) || 0),
                type: t.type === 'income' || t.type === 'payment' ? t.type : 'expense',
                category: t.category || 'otros',
            }));
            const { error: tErr } = await supabase.from('statement_transactions').insert(rows);
            if (tErr) throw new Error(`No se pudieron guardar los movimientos: ${tErr.message}`);
        }

        return NextResponse.json({
            ok: true,
            statementId,
            summary: {
                account_id: accountId,
                account_name: accountName,
                account_created: accountCreated,
                bank: parsed.bank,
                account_type: parsed.account_type,
                last4: parsed.last4,
                period_label: parsed.period_label,
                statement_date: parsed.statement_date,
                due_date: parsed.due_date,
                new_balance: parsed.new_balance,
                minimum_payment: parsed.minimum_payment,
                no_interest_payment: parsed.no_interest_payment,
                total_income: parsed.total_income,
                total_expense: parsed.total_expense,
                transactions: parsed.transactions.length,
                notes: parsed.notes,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
