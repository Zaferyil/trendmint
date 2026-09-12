import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const handler = async (event) => {
  // CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "OK" }),
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { postCount, postTypes, contentFocus = "80" } = JSON.parse(
      event.body
    );

    const prompt = `Du bist ein Instagram Content Manager für SirkWTime (Österreich).
Hauptfokus: Mental Aritmetik (${contentFocus}%)
Sekundär: Brain Fit Kids Bundle Promotion (${100 - contentFocus}%)

Zielmarkt: Österreich
Zielgruppe: Kinder & Eltern
Sprache: Deutsch (österreichisches Deutsch)

Erzeuge ${postCount} Instagram Captions/Descriptions.
Post-Typen: ${postTypes.join(", ")}

Für jeden Post:
- Kurz, prägnant, engagierend
- Mit relevanten Hashtags
- Emojis verwenden (aber nicht zu viele)
- Call-to-Action einbauen

Format als JSON:
{
  "posts": [
    {
      "type": "Story|Beitrag|Reels",
      "content": "Caption text here...",
      "hashtags": ["tag1", "tag2", ...]
    }
  ]
}`;

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract JSON from response
    let responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Try to parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const generatedPosts = jsonMatch ? JSON.parse(jsonMatch[0]) : { posts: [] };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: generatedPosts.posts,
        message: `${generatedPosts.posts?.length || 0} Posts generiert`,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || "Content generation failed",
      }),
    };
  }
};
