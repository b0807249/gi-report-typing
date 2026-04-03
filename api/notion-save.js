export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DB_ID = process.env.NOTION_DB_ID;

  if (!NOTION_TOKEN || !NOTION_DB_ID) {
    return res.status(500).json({ error: "NOTION_TOKEN or NOTION_DB_ID not set" });
  }

  try {
    const {
      chartNo,
      biopsy,
      cloTest,
      cloResult,
      disease,
      procedures,
      quote,
      notes,
      bodyContent,
    } = req.body;

    if (!chartNo) {
      return res.status(400).json({ error: "chartNo is required" });
    }

    // Build properties
    const properties = {
      病歷號: {
        title: [{ text: { content: String(chartNo) } }],
      },
    };

    // Biopsy (Status: Y/N)
    if (biopsy) {
      properties["Biopsy"] = { status: { name: biopsy } };
    }

    // CLO test (Status: Y/N)
    if (cloTest) {
      properties["CLO test"] = { status: { name: cloTest } };
    }

    // CLO結果 (Status: 陽/陰)
    if (cloResult) {
      properties["CLO結果"] = { status: { name: cloResult } };
    }

    // 疾病 (Rich text)
    if (disease) {
      properties["疾病"] = {
        rich_text: [{ text: { content: disease } }],
      };
    }

    // Quote (Rich text)
    if (quote) {
      properties["Quote"] = {
        rich_text: [{ text: { content: quote.slice(0, 2000) } }],
      };
    }

    // 後記/臨床狀況 (Rich text)
    if (notes) {
      properties["後記/臨床狀況"] = {
        rich_text: [{ text: { content: notes } }],
      };
    }

    // 介入 (Multi-select)
    if (procedures && procedures.length > 0) {
      properties["介入"] = {
        multi_select: procedures.map((p) => ({ name: p })),
      };
    }

    // Build page body content (report text as blocks)
    const children = [];
    if (bodyContent) {
      // Split into chunks of 2000 chars (Notion block limit)
      const chunks = [];
      let remaining = bodyContent;
      while (remaining.length > 0) {
        chunks.push(remaining.slice(0, 2000));
        remaining = remaining.slice(2000);
      }
      for (const chunk of chunks) {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: chunk } }],
          },
        });
      }
    }

    // Create page in Notion
    const body = {
      parent: { database_id: NOTION_DB_ID },
      properties,
    };
    if (children.length > 0) {
      body.children = children;
    }

    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Notion API error:", JSON.stringify(data));
      return res.status(response.status).json({
        error: "Notion API error",
        details: data,
      });
    }

    return res.status(200).json({
      success: true,
      pageId: data.id,
      url: data.url,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: err.message });
  }
}
