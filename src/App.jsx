import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";

function App() {
  const [userName, setUserName] = useState("alice"); // 自分の名前
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null); 

  // 初回ロードで投稿一覧を取得
  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
  console.error("fetch error:", error);
  alert("読み込みエラー: " + error.message);
} else {
  setPosts(data);
}

    setLoading(false);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  // 名前が空 or ファイルが選ばれてないときは何もしない
  if (!userName.trim() || !file) {
    alert("名前と画像を選んでね");
    return;
  }

  // ========== 1) Supabase Storage に画像をアップロード ==========
  const ext = file.name.split(".").pop(); // 拡張子（jpg, png など）
  const fileName =
    `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `${userName}/${fileName}`; // ユーザー名フォルダっぽく保存

  const { error: uploadError } = await supabase.storage
    .from("images")            // ← さっき作ったバケット名
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("upload error:", uploadError);
    alert("画像のアップロードに失敗しました: " + uploadError.message);
    return;
  }

  // ========== 2) 公開URLを取得 ==========
  const {
    data: { publicUrl },
  } = supabase.storage.from("images").getPublicUrl(filePath);

  // ========== 3) posts テーブルにレコードを追加 ==========
  const { error: insertError } = await supabase.from("posts").insert({
    user_name: userName.trim(),
    image_url: publicUrl,           // ← ここに今のURLを保存
    caption: caption.trim() || null,
  });

  if (insertError) {
    console.error("insert error:", insertError);
    alert("投稿に失敗しました: " + insertError.message);
    return;
  }

  // ========== 4) フォームをリセットして再読み込み ==========
  setFile(null);
  setCaption("");
  await fetchPosts();
};


  return (
    <div className="app">
      <header className="header">
        <div className="logo">miniInsta</div>
        <div className="user-info">
          <span className="avatar">
            {userName ? userName[0].toUpperCase() : "?"}
          </span>
          <input
            className="username-input"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="あなたの名前"
          />
        </div>
      </header>

      <main className="main">
        <section className="timeline-section">
          <form className="new-post" onSubmit={handleSubmit}>
            <h2>新規投稿</h2>
            <input
            type="file"
            accept="image/*"
            onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
  }}
/>
            <input
              type="text"
              placeholder="キャプション（任意）"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <button type="submit">投稿</button>
          </form>

          {loading && <p>読み込み中...</p>}

          <Timeline posts={posts} />
        </section>
      </main>
    </div>
  );
}

function Timeline({ posts }) {
  if (!posts.length) {
    return <p>まだ投稿がありません。</p>;
  }

  return (
    <div className="timeline">
      {posts.map((post) => (
        <article key={post.id} className="post-card">
          <header className="post-header">
            <div className="post-avatar">
              {post.user_name ? post.user_name[0].toUpperCase() : "?"}
            </div>
            <div>
              <div className="post-username">{post.user_name}</div>
              <div className="post-display-name">{post.user_name}</div>
            </div>
          </header>
          <div className="post-image-wrapper">
            <img src={post.image_url} alt={post.caption || ""} />
          </div>
          <div className="post-body">
            {post.caption && (
              <p>
                <strong>{post.user_name}</strong> {post.caption}
              </p>
            )}
            <time className="post-time">
              {new Date(post.created_at).toLocaleString()}
            </time>
          </div>
        </article>
      ))}
    </div>
  );
}

export default App;
