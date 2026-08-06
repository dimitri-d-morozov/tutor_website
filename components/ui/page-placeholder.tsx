import { Card, CardTitle } from "./card";

/** Заглушка раздела, который будет наполнен на следующих шагах. */
export function PagePlaceholder({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div>
      <h1 className="mb-2 font-display text-2xl">{title}</h1>
      {note && <p className="mb-6 text-ink-soft">{note}</p>}
      <Card>
        <CardTitle>В разработке</CardTitle>
        <p className="text-sm text-ink-soft">
          Этот раздел появится на следующем шаге разработки.
        </p>
      </Card>
    </div>
  );
}
