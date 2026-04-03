export default async function handler(req, res) {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) {
    return res.status(500).json({ error: "NOTION_TOKEN not set" });
  }

  const PAGE_ID = "1ea106028a14809e9dcdde8b3bd3b933";

  try {
    const response = await fetch(
      `https://api.notion.com/v1/blocks/${PAGE_ID}/children?page_size=100`,
      {
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
        },
      }
    );
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    const databases = data.results
      .filter((b) => b.type === "child_database")
      .map((b) => ({ id: b.id, title: b.child_database?.title }));

    if (databases.length === 0) {
      return res.status(404).json({ error: "No inline database found on this page" });
    }

    return res.status(200).json({
      message: "Found database(s). Copy the ID and add it as NOTION_DB_ID in Vercel env vars.",
      databases,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
