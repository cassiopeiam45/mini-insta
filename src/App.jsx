import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";

function App() {
  const [userName, setUserName] = useState("");
  const [caption, setCaption] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [nameLocked, setNameLocked] = useState(false);

  // 起動時にローカルストレージから名前を復元
  useEffect(() => {
    const saved = localStorage.getItem("miniInstaUserName");
    if (saved) {
      setUserName(saved);
      setNameLocked(true);
    }
  }, []);

  // 起動時に投稿一覧を取得
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

    if (!userName.trim()) {
      alert("名前を入力してね");
      return;
    }
    if (!file) {
      alert("画像を選んでね");
      return;
    }

    // 初めて投稿する時に名前を固定して保存
    if (!nameLocked) {
      const fixed = userName.trim();
      localStorage.setItem("miniInstaUserName", fixed);
      setUserName(fixed);
      setNameLocked(true);
    }

    // ========== 1) Supabase Storage に画像をアップロード ==========
    // ========== 1) Supabase Storage に画像をアップロード ==========
// ファイル名は「タイムスタンプ + ランダム英数字」だけにする（ユーザー名は使わない）
const ext = file.name.split(".").pop();
const filePath =
  `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;


    const { error: uploadError } = await supabase.storage
      .from("images") // ★ バケット名: images（小文字）
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
      image_url: publicUrl,
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

  // 投稿削除
  const handleDelete = async (postId, postUserName) => {
    // 念のためフロント側でも自分の投稿だけに制限
    if (postUserName !== userName) {
      alert("自分の投稿だけ削除できます");
      return;
    }

    if (!window.confirm("この投稿を削除しますか？")) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_name", userName);

    if (error) {
      console.error("delete error:", error);
      alert("削除に失敗しました: " + error.message);
      return;
    }

    // ローカル状態からも削除
    setPosts((prev) => prev.filter((p) => p.id !== postId));
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
            type="text"
            value={userName}
            onChange={(e) => {
              if (!nameLocked) {
                setUserName(e.target.value);
              }
            }}
            placeholder="ユーザー名"
            disabled={nameLocked}
          />
          <span style={{ fontSize: 12, marginLeft: 8 }}>
            ※ 一度決めた名前はあとから変えられません
          </span>
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

          <Timeline
            posts={posts}
            currentUserName={userName}
            onDelete={handleDelete}
          />
        </section>
      </main>
    </div>
  );
}

function Timeline({ posts, currentUserName, onDelete }) {
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
            <div className="post-header-main">
              <div className="post-username">{post.user_name}</div>
              <div className="post-display-name">{post.user_name}</div>
            </div>

            {/* 自分の投稿だけ削除ボタンを表示 */}
            {post.user_name === currentUserName && (
              <button
                className="post-delete-button"
                onClick={() => onDelete(post.id, post.user_name)} // ★ ここ user_name
              >
                削除
              </button>
            )}
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
