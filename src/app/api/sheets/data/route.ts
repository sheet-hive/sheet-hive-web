import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Firebase Admin初期化
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const auth = getAuth();

export async function GET(request: NextRequest) {
  try {
    // Authorization ヘッダーから Firebase ID トークンを取得
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // クエリパラメータからスプレッドシートIDと範囲を取得
    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheetId");
    const range = searchParams.get("range") || "Sheet1"; // デフォルトは Sheet1 全体

    if (!spreadsheetId) {
      return NextResponse.json({ error: "spreadsheetId is required" }, { status: 400 });
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

    // Google Sheets API を呼び出してデータを取得
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Sheets API Error:", {
        status: response.status,
        statusText: response.statusText,
        errorData,
        spreadsheetId,
        range,
      });
      
      // ユーザー向けのわかりやすいメッセージを返す（詳細はサーバログのみ）
      let message = "データの取得に失敗しました";
      if (response.status === 404) {
        message = "指定されたシートが見つかりません";
      } else if (response.status === 403) {
        message = "このスプレッドシートへのアクセス権限がありません";
      }
      
      return NextResponse.json(
        { error: "Failed to fetch spreadsheet data", message },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      range: data.range,
      majorDimension: data.majorDimension,
      values: data.values || [],
    });
  } catch (err) {
    console.error("Error in /api/sheets/data:", err);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        message: "サーバーでエラーが発生しました。しばらく待ってから再試行してください" 
      },
      { status: 500 }
    );
  }
}
