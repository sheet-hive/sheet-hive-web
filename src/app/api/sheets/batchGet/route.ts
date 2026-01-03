import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin, isDemoMode } from "@/lib/server/firebaseAdmin";

// batchGetを使用して複数範囲のデータを一度に取得
export async function POST(req: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: "Not available in demo mode" },
        { status: 404 }
      );
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Firebase Admin is not configured" },
        { status: 500 }
      );
    }

    const { db, auth } = admin;

    // Authorization ヘッダーから Firebase ID トークンを取得
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const body = await req.json();
    const { spreadsheetId, ranges } = body;

    if (!spreadsheetId || !ranges) {
      return NextResponse.json(
        { error: "spreadsheetId and ranges are required" },
        { status: 400 }
      );
    }

    // Firestoreからアクセストークンを取得
    const tokenDoc = await db.collection("users").doc(uid).collection("tokens").doc("google").get();
    
    if (!tokenDoc.exists) {
      return NextResponse.json({ error: "No Google token found. Please sign in again." }, { status: 401 });
    }

    const tokenData = tokenDoc.data();
    const accessToken = tokenData?.accessToken;
    const expiresAt = tokenData?.expiresAt;

    if (!accessToken) {
      return NextResponse.json({ error: "Invalid token data" }, { status: 401 });
    }

    // トークンの有効期限をチェック
    if (expiresAt) {
      const expiryDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
      if (expiryDate <= new Date()) {
        return NextResponse.json({ 
          error: "Token expired", 
          message: "アクセストークンの有効期限が切れました。再度サインインしてください。" 
        }, { status: 401 });
      }
    }

    // Google Sheets API の batchGet を呼び出し
    const rangesParam = Array.isArray(ranges) ? ranges : [ranges];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesParam.map(r => `ranges=${encodeURIComponent(r)}`).join('&')}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Sheets API Error:", {
        status: response.status,
        error: errorData,
      });

      return NextResponse.json(
        {
          error: "Failed to fetch sheet data",
          message: errorData.error?.message || "データの取得に失敗しました",
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      spreadsheetId: data.spreadsheetId,
      valueRanges: data.valueRanges,
    });
  } catch (error: unknown) {
    console.error("batchGet API error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch sheet data",
        message: error instanceof Error ? error.message : "不明なエラーが発生しました",
      },
      { status: 500 }
    );
  }
}

