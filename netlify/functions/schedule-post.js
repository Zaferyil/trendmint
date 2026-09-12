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
    const {
      postContent,
      postType,
      scheduledTime,
      postCount,
      selectedTimes,
    } = JSON.parse(event.body);

    // In production, this would store the scheduled posts in a database
    // and use a cron job (GitHub Actions) to post them at the scheduled times

    const scheduledPosts = [];

    for (let i = 0; i < postCount; i++) {
      scheduledPosts.push({
        id: `scheduled_${Date.now()}_${i}`,
        content: postContent,
        type: postType,
        scheduledTime: selectedTimes[i % selectedTimes.length],
        status: "scheduled",
        createdAt: new Date().toISOString(),
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        scheduledPosts,
        message: `${postCount} Posts erfolgreich zeitgeplant`,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to schedule posts",
      }),
    };
  }
};
