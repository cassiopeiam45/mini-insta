import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";

function App() {
  const [userName, setUserName] = useState("alice"); // 自分の名前
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

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
    if (!userName.trim() || !imageUrl.trim()) return;

    const { error } = await supabase.from("posts").insert({
      user_name: userName.trim(),
      image_url: imageUrl.trim(),
      caption: caption.trim() || null,
    });

    if (error) {
      console.error("insert error:", error);
      return;
    }

    setImageUrl("");
    setCaption("");
    await fetchPosts(); // 再読み込み
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
              type="text"
              placeholder="画像のURLを貼り付け"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
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
