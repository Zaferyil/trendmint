const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
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
    const { postContent, postType, accessToken, accountId } = JSON.parse(
      event.body
    );

    if (!accessToken || !accountId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Missing Instagram credentials",
        }),
      };
    }

    // Simulate Instagram API call
    // In production, this would use the Instagram Graph API
    // POST /ig_business_account_id/media

    const simulatedResponse = {
      success: true,
      postId: `post_${Date.now()}`,
      type: postType,
      status: "posted",
      timestamp: new Date().toISOString(),
      content: postContent.substring(0, 100) + "...",
      message: `${postType} erfolgreich auf Instagram gepostet`,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(simulatedResponse),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to post to Instagram",
      }),
    };
  }
};
