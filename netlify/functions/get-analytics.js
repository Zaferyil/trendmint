const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { timeRange = "week", accountId } = event.queryStringParameters || {};

    if (!accountId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Missing accountId parameter",
        }),
      };
    }

    // In production, this would fetch real data from Instagram Graph API
    // GET /ig_business_account_id/insights

    const mockAnalytics = {
      totalViews: 12450,
      totalLikes: 1230,
      totalComments: 156,
      followers: 3450,
      engagementRate: 9.87,
      reachGrowth: 23,
      topContent: [
        {
          id: "post_1",
          type: "Reels",
          views: 5430,
          likes: 523,
          comments: 87,
          engagement: 9.6,
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "post_2",
          type: "Beitrag",
          views: 4210,
          likes: 398,
          comments: 52,
          engagement: 9.4,
          timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "post_3",
          type: "Story",
          views: 2810,
          likes: 309,
          comments: 17,
          engagement: 11.0,
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      dailyMetrics: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        views: Math.floor(Math.random() * 5000) + 500,
        likes: Math.floor(Math.random() * 500) + 50,
        followers: 3400 + i * 2,
      })),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: mockAnalytics,
        timeRange,
        message: "Analytics erfolgreich abgerufen",
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to fetch analytics",
      }),
    };
  }
};
