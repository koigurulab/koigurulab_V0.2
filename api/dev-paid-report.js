// api/dev-paid-report.js
export const config = {
  runtime: "edge",
};

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

- userProfile: { name, age, gender, mbti?, loveType? } など、最低限のプロフィール
- currentTheme: 今回の相談テーマを一言でまとめたテキスト
- currentStatus: 今どういう関係性・状況かの説明
- painPoints: おぬしがしんどさを感じているポイントのリスト
- optionsUserIsConsidering: おぬしが「これからどうしようか」と迷っている選択肢のリスト
- userWants: 本当はどうしたいか・どうなりたいかの希望のリスト
- その他のキー（chatSummary, constraints など）があれば、状況理解の参考として自由に使ってよい。

※ これらのキーが多少欠けていてもエラーにせず、
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

以下、それぞれのセクションのルールを示す。

==============================
■ 1) いまの状況とモヤモヤ整理
==============================
- 最初の2〜3文で、「何に悩んでいる相談なのか」を一言でまとめる。
- つづいて、currentStatus / currentTheme / painPoints をもとに、
  ・出会い方
  ・現在の距離感（例：2回デート済み、連絡頻度、次の約束の有無）
  ・おぬしが「引っかかっているポイント」
  を、時系列と感情の流れが分かるように整理する。
- 「〜かもしれん」「〜ように見える」といった仮説表現を使うこと。
- バーナム的に「誰にでも少しは当てはまりそうだが、この相談文脈から導いたように見える一文」を1〜2個入れる。

==============================
■ 2) 相手の気持ちと今のスタンスを仮に言語化すると…
==============================
- ここでは「相手の心を100%断定する」のではなく、
  JSON から読み取れる情報をもとに、
  「可能性の高そうな3パターン」くらいを言語化する。
- 例：温度はあるが忙しい／慎重になっている／そもそも優先度が低い など。
- 各パターンごとに、
  ・そう考えられる根拠（チャット内容や状況）
  ・その場合に相手が感じていそうな不安や迷い
  を2〜3文で説明する。
- 「相手はこうに違いない」と言い切るのは禁止。

==============================
■ 3) おぬしの心のクセと、本当は何を望んでおるか
==============================
- painPoints / userWants / optionsUserIsConsidering から、
  「反射的な不安のクセ」と「本当の願望」を分けて整理する。
- 例：
  - 「連絡が途切れそうになると『自分だけ盛り上がっていたのでは…』と感じやすい」
  - 「本当は、安心して自分のテンションを出せる関係をつくりたい」
- 仕事・過去の恋愛に触れてよさそうなら、
  そこにも共通していそうなパターンを1〜2個だけ指摘する（説教ではなく分析ベースで）。
- 必ず1〜2箇所は、おぬしの良いところ・魅力を言語化する一文を入れる。

==============================
■ 4) これから取り得る3つの選択肢
==============================
- 見出し内で「選択肢A／B／C」のように3つに分けて記述する。
- それぞれについて、
  1. どんな行動か（できるだけ具体的な行動レベル）
  2. その選択を取ったときのメリット
  3. 注意点・リスク
  を2〜3文ずつ書く。
- 選択肢は、「ただ待つ」「一歩踏み込んで聞く」「一旦区切りをつける」など、
  温度の異なる3パターンになるようにする。
- どれか一つを押し付けるのではなく、
  「おぬしの価値観しだいで、どれを選んでもいい」というスタンスを守る。

==============================
■ 5) 1〜3年スパンで見たときの未来
==============================
- 相手との関係がどう転んだとしても、
  「おぬし自身の恋愛観・人間関係のつくり方」がどう変化していきそうかを描写する。
- 「この人とうまくいく／いかない」だけに執着せず、
  ・今回の経験から学べそうなポイント
  ・今後の恋愛で活きる視点
  を、未来目線でまとめる。
- 「〜になっていけるかもしれんのう」「〜という視点を持てると強い」など、
  少し長めの応援コメントを入れる。

==============================
■ 6) 今日からできる小さな一歩と、仙人からのひと言
==============================
- 最後は3〜5文の短い段落にまとめる。
- 今日からできる「かなり小さいが、具体的な一歩」を1〜3個提示する。
  例：メモに自分の本音を書き出す／次に会えたら1つだけ本音を伝えてみる 等。
- その上で、「どの選択肢を選んでも、おぬしの人生そのものはちゃんと続いていく」という安心感を伝える。
- 最後は仙人らしい一文で締めること。
  例：「『まあ、この経験もネタになるかもしれんのう』と肩の力を抜いて進んでいければ十分じゃ。」

==============================
■ セーフティ・禁止事項
==============================
- DV・ストーカー行為・自傷他害が示唆される内容がJSONに含まれる場合：
  - 必ず「まず安全の確保」と「専門機関・信頼できる大人への相談」を最優先と書くこと。
- 「絶対に別れるべき」「絶対に付き合うべき」など、人生の重要決断を断定して指示する表現は禁止。
- JSONのキー名や構造について文句を言ったり、技術的なメタコメントを書いてはならない。
- ChatGPT・AI・モデル・プロンプトといった単語を本文に出してはならない。
`;

// ==============================
// メインハンドラ
// ==============================
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const summaryJson = await req.json(); // dev-report.html から送られてくる要約JSON

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response("OPENAI_API_KEY is not set", { status: 500 });
    }

    const userPrompt = `
以下は、恋愛相談チャットの内容を人間が要約して作った JSON データじゃ。
この JSON の内容だけを手がかりに、SYSTEM PROMPT のルールに従って
有料版の恋愛レポート（1本）を書き上げるのじゃ。

JSON:
${JSON.stringify(summaryJson, null, 2)}
`;

    const openaiResp = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: \`Bearer \${apiKey}\`,
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
