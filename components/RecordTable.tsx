interface RecordTableProps {
  columns: string[];
  rows: Array<Array<string | number>>;
  caption?: string;
}

export function RecordTable({ columns, rows, caption }: RecordTableProps) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-background">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-left text-sm">
          <thead className="bg-background">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground"
                  scope="col"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {rows.map((row, index) => (
              <tr
                key={`${row[0] ?? "row"}-${index}`}
                className="transition hover:bg-[#111111]"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${index}-${cellIndex}`}
                    className="px-4 py-3 align-top text-foreground"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption ? (
        <div className="border-t border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
          {caption}
        </div>
      ) : null}
    </div>
  );
}
