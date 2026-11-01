-- Preserve the status needed by accounting recognition without widening writes.
grant select(recurring_instance_status) on public.transactions to tb_mcp_reader;
update mcp_private.read_tables
set columns_csv=columns_csv||',recurring_instance_status'
where name='transactions' and not ('recurring_instance_status'=any(string_to_array(columns_csv,',')));
