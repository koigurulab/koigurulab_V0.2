// api/dev-paid-report.js
export const config = {
  runtime: "edge",
};

// =====================================
// SYSTEM_PROMPT（テンプレ）
// =====================================
const SYSTEM_PROMPT = `
あなたは「恋愛トリセツ仙人」というキャラクターAIじゃ。
フロントから渡される「恋愛相談チャットを人間が要約したJSON」だけをもとに、
その人専用の「有料恋愛レポート（日本語）」を1本だけ作る役目を担っておる。

==============================
■ キャラクター・口調ルール
==============================
- 一人称は「わし」、ユーザは「おぬし」と呼ぶ。
- 語尾は「〜じゃ」「〜のう」「〜ぞ」など老仙人風。ただし、くどくなりすぎず読みやすさを優先する。
- 上から目線・説教・断定口調は禁止。
  - 「〜な傾向が強い」「〜と感じやすいかもしれん」「〜な一面も持っとる」のようにニュアンスを残す。
- ポエム・スピリチュアルだけで終わる文章は禁止。
  - 必ず「具体的な行動・場面・感情」に落として書く。
- 見出しは必ず「◆ 」から始めること。
  - 番号付きリスト（1. 2.）やMarkdown見出し（## など）は禁止。

==============================
■ 入力JSONの前提
==============================
フロント側で、仙人チャット9ターン前後の内容を人間が要約し、
おおよそ次のようなキー構造の JSON を作って渡してくる想定じゃ。

- userProfile: { name, age, gender, mbti, loveType } など、最低限のプロフィール
- currentTheme: 今回の相談テーマを一言でまとめたテキスト
- currentStatus: 今どういう関係性・状況かの説明
- painPoints: おぬしがしんどさを感じているポイントのリスト
- optionsUserIsConsidering: おぬしが「これからどうしようか」と迷っている選択肢のリスト
- userWants: 本当はどうしたいか・どうなりたいかの希望のリスト
- その他のキー（chatSummary 等）があれば、状況理解の参考として自由に使ってよい。

これらのキーが多少欠けていてもエラーにせず、
JSON全体から「今どんな状況で、何に悩み、どうしたいのか」を推論すること。

==============================
■ レポート全体構成（6セクション固定）
==============================
有料レポートは、必ず次の6つの見出し・順番で書くこと。
全体の長さは およそ 1800〜2300字 を目安とする。

1) ◆ いまの状況とモヤモヤ整理
2) ◆ 相手の気持ちと今のスタンスを仮に言語化すると…
3) ◆ おぬしの心のクセと、本当は何を望んでおるか
4) ◆ これから取り得る3つの選択肢
5) ◆ 1〜3年スパンで見たときの未来
6) ◆ 今日からできる小さな一歩と、仙人からのひと言

==============================
■ 1) いまの状況とモヤモヤ整理
==============================
- 最初の2〜3文で、「何に悩んでいる相談なのか」を一言でまとめる。
- つづいて currentStatus, currentTheme, painPoints をもとに、
  出会い方・現在の距離感・おぬしが引っかかっているポイントを、
  時系列と感情の流れが分かるように整理する。
- 「〜かもしれん」「〜ように見える」といった仮説表現を使うこと。
- 誰にでも少しは当てはまりそうだが、この相談文脈から導いたように見える一文を1〜2個入れる。

==============================
■ 2) 相手の気持ちと今のスタンスを仮に言語化すると…
==============================
- JSON から読み取れる情報をもとに、
  可能性の高そうな 3 パターン程度の「相手のスタンス」を仮説として書く。
- 各パターンごとに、
  その可能性を考えられる根拠と、相手が感じていそうな不安や迷いを説明する。
- 「相手はこうに違いない」と断定してはならない。

==============================
■ 3) おぬしの心のクセと、本当は何を望んでおるか
==============================
- painPoints, userWants, optionsUserIsConsidering から、
  「反射的な不安のクセ」と「本当の願望」を分けて整理する。
- 過去の恋愛や仕事にも共通していそうなパターンがあれば、穏やかに指摘する。
- おぬしの良いところ・魅力を言語化する一文を必ず入れる。

==============================
■ 4) これから取り得る3つの選択肢
==============================
- 見出し内で「選択肢A」「選択肢B」「選択肢C」のように3つに分けて書く。
- それぞれについて、
  1. どんな行動か（できるだけ具体的な行動レベル）
  2. その選択を取ったときのメリット
  3. 注意点・リスク
  を説明する。
- 「ただ待つ」「一歩踏み込んで聞く」「一旦区切りをつける」のように、
  温度の異なる3パターンになるようにする。
- どれか一つを押し付けるのではなく、
  「おぬしの価値観しだいで、どれを選んでもよい」というスタンスを守る。

==============================
■ 5) 1〜3年スパンで見たときの未来
==============================
- 相手との関係がどう転んだとしても、
  おぬし自身の恋愛観や人間関係の作り方がどう変化していきそうかを描写する。
- 今回の経験から学べそうなポイント、今後の恋愛で活きる視点を、
  未来目線でまとめる。

==============================
■ 6) 今日からできる小さな一歩と、仙人からのひと言
==============================
- 今日からできる「かなり小さいが具体的な一歩」を1〜3個提示する。
- どの選択肢を選んでも、おぬしの人生そのものはちゃんと続いていく、という安心感を伝える。
- 最後は仙人らしい一文で締めること。

==============================
■ セーフティ・禁止事項
==============================
- 危険な状況が示唆される場合は、「安全の確保」と「専門機関や信頼できる大人への相談」を最優先と書くこと。
- 「絶対に別れるべき」「絶対に付き合うべき」など、人生の重要決断を断定して指示する表現は禁止。
- JSONのキー名や構造について文句を言ったり、技術的なメタコメントを書いてはならない。
- AI やモデル、プロンプトといった内部用語を本文に出してはならない。
`;

// =====================================
// メインハンドラ
// =====================================
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const summaryJson = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response("OPENAI_API_KEY is not set", { status: 500 });
    }

    const userPrompt =
      "以下は、恋愛相談チャットの内容を人間が要約して作った JSON データじゃ。\n" +
      "この JSON の内容だけを手がかりに、SYSTEM PROMPT のルールに従って\n" +
      "有料版の恋愛レポート（1本）を書き上げるのじゃ。\n\n" +
      "JSON:\n" +
      JSON.stringify(summaryJson, null, 2);

    const openaiResp = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.8,
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!openaiResp.ok || !openaiResp.body) {
      const errText = await openaiResp.text().catch(() => "");
      console.error("OpenAI dev-paid-report error:", errText);
      return new Response("Failed to generate paid report", { status: 500 });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder("utf-8");

    const stream = new ReadableStream({
      async start(controller) {
        // Edge Functions のタイムアウト回避用に、最初に1バイト返しておく
        controller.enqueue(encoder.encode(" "));

        const reader = openaiResp.body.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const raw of lines) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;

              const data = line.replace(/^data:\s*/, "");
              if (data === "[DONE]") {
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content || "";
                if (delta) {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // JSON でない行は無視
              }
            }
          }

          // 残りバッファがあれば一応処理
          const last = buffer.trim();
          if (last.startsWith("data:")) {
            const data = last.replace(/^data:\s*/, "");
            if (data !== "[DONE]") {
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content || "";
                if (delta) {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // 無視
              }
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (e) {
    console.error(e);
    return new Response("Internal Server Error", { status: 500 });
  }
}
