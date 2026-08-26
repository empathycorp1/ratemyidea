// Placeholder only, per instructions — the Highlight Board screen
// itself will be designed separately. This just needs to exist so
// "Highlight this idea" on the result page has somewhere to go.

type Props = { params: Promise<{ id: string }> };

export default async function HighlightPlaceholder({ params }: Props) {
  const { id } = await params;

  return (
    <div style={{ padding: 20, fontFamily: "monospace" }}>
      <p>Highlighting for idea #{id} — coming soon.</p>
    </div>
  );
}
