import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";

function App() {
  const [userName, setUserName] = useState("");
  const [caption, setCaption] = useState("");
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [nameLocked, setNameLocked] = useState(false);

  // 画面状態: "timeline" | "profile"
  const [view, setView] = useState("timeline");
  const [profileUser, setProfileUser] = useState(null);

  // 自分のアバターURL
  const [avatarUrl, setAvatarUrl] = useState(null);

  // ================================
  // プロフィール画像の読み込み
  // ================================
  const loadAvatar = async (name) => {
    if (!name) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_name", name)
      .maybeSingle();

    if (error) {
      console.error("fetch profile error:", error);
      return;
    }
    setAvatarUrl(data?.avatar_url || null);
  };

  // ================================
  // アバターアップロード
  // ================================
  const handleAvatarUpload = async (file) => {
    if (!userName || !file) return;

    const ext = file.name.split(".").pop() || "png";

    // ユーザー名を入れず、英数字だけのパスにする（日本語キー対策）
    const filePath = `avatar-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true, // 同じキーなら上書きでOK
      });

    if (uploadError) {
      console.error("avatar upload error:", uploadError);
      alert("アイコンのアップロードに失敗しました: " + uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_name: userName,
          avatar_url: publicUrl,
        },
        { onConflict: "user_name" } // user_name がユニークキーの場合
      );

    if (upsertError) {
      console.error("profile upsert error:", upsertError);
      alert("プロフィールの保存に失敗しました: " + upsertError.message);
      return;
    }

    setAvatarUrl(publicUrl);
  };

  // ================================
  // 雪アニメーション
  // ================================
  useEffect(() => {
    const container = document.getElementById("snow-container");
    if (!container) return;

    const flakes = [];

    const createFlake = () => {
      const flake = document.createElement("div");
      flake.className = "snowflake";
      flake.textContent = "❄";

      flake.style.left = Math.random() * 100 + "vw";
      const size = 8 + Math.random() * 10;
      flake.style.fontSize = size + "px";
      flake.style.animationDuration = 5 + Math.random() * 10 + "s";
      flake.style.opacity = 0.3 + Math.random() * 0.7;

      container.appendChild(flake);
      flakes.push(flake);

      setTimeout(() => {
        flake.remove();
      }, 15000);
    };

    const interval = setInterval(createFlake, 300);
    for (let i = 0; i < 30; i++) createFlake();

    return () => {
      clearInterval(interval);
      flakes.forEach((f) => f.remove());
    };
  }, []);

  // ================================
  // 起動時: 名前を復元 & アバター取得
  // ================================
  useEffect(() => {
    const saved = localStorage.getItem("miniInstaUserName");
    if (saved) {
      setUserName(saved);
      setNameLocked(true);
      loadAvatar(saved);
    }
  }, []);

  // ================================
  // 起動時: 投稿・コメント読み込み
  // ================================
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAll = async () => {
    setLoading(true);

    // 投稿
    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (postsError) {
      console.error("fetch posts error:", postsError);
      alert("投稿の読み込みエラー: " + postsError.message);
    } else {
      setPosts(postsData || []);
    }

    // コメント
    const { data: commentsData, error: commentsError } = await supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: true });

    if (commentsError) {
      console.error("fetch comments error:", commentsError);
    } else {
      setComments(commentsData || []);
    }

    if (userName) {
      await fetchNotifications();
    }

    setLoading(false);
  };

  // ================================
  // 通知の取得
  // ================================
  const fetchNotifications = async () => {
    if (!userName) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_name", userName)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("fetch notifications error:", error);
      return;
    }

    setNotifications(data || []);
  };

  // ================================
  // 投稿送信
  // ================================
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

    if (!nameLocked) {
      const fixed = userName.trim();
      localStorage.setItem("miniInstaUserName", fixed);
      setUserName(fixed);
      setNameLocked(true);
    }

    const ext = file.name.split(".").pop();
    const filePath = `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("upload error:", uploadError);
      alert("画像のアップロードに失敗しました: " + uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(filePath);

    const { data: inserted, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_name: userName.trim(),
        image_url: publicUrl,
        caption: caption.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("insert error:", insertError);
      alert("投稿に失敗しました: " + insertError.message);
      return;
    }

    setFile(null);
    setCaption("");
    setPosts((prev) => [inserted, ...prev]);
  };

  // ================================
  // 投稿削除
  // ================================
  const handleDelete = async (postId, postUserName) => {
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

    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setComments((prev) => prev.filter((c) => c.post_id !== postId));
  };

  // ================================
  // いいね
  // ================================
  const handleLike = async (post) => {
    if (!userName.trim()) {
      alert("名前を入力してからいいねしてね");
      return;
    }

    const newLikes = (post.likes || 0) + 1;

    const { data, error } = await supabase
      .from("posts")
      .update({ likes: newLikes })
      .eq("id", post.id)
      .select()
      .single();

    if (error) {
      console.error("like update error:", error);
      alert("いいねに失敗しました: " + error.message);
      return;
    }

    setPosts((prev) => prev.map((p) => (p.id === post.id ? data : p)));

    if (post.user_name !== userName) {
      await supabase.from("notifications").insert({
        user_name: post.user_name,
        from_user: userName,
        post_id: post.id,
        kind: "like",
      });
    }
  };

  // ================================
  // プロフィール画面切り替え
  // ================================
  const openProfile = (name) => {
    if (!name) return;
    setProfileUser(name);
    setView("profile");
  };

  const backToTimeline = () => {
    setView("timeline");
    setProfileUser(null);
  };

  // ================================
  // コメント追加
  // ================================
  const handleAddComment = async (post, text) => {
    const body = text.trim();
    if (!userName.trim()) {
      alert("名前を入力してからコメントしてね");
      return;
    }
    if (!body) return;

    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: post.id,
        user_name: userName.trim(),
        body,
      })
      .select()
      .single();

    if (error) {
      console.error("add comment error:", error);
      alert("コメントに失敗しました: " + error.message);
      return;
    }

    setComments((prev) => [...prev, data]);

    if (post.user_name !== userName) {
      await supabase.from("notifications").insert({
        user_name: post.user_name,
        from_user: userName,
        post_id: post.id,
        kind: "comment",
        body,
      });
    }
  };

  // ================================
  // 通知
  // ================================
  const unreadCount = notifications.filter((n) => !n.read).length;

  const toggleNotifications = async () => {
    const willOpen = !showNotifications;
    setShowNotifications(willOpen);

    if (willOpen && userName) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_name", userName)
        .eq("read", false);

      if (error) {
        console.error("mark read error:", error);
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    }
  };

  // ================================
  // JSX
  // ================================
  return (
    <div className="app">
      <div id="snow-container" className="snow-container" />
      <header className="header">
        <div className="logo">miniInsta</div>

        <button
          className="profile-button"
          disabled={!userName}
          onClick={() => openProfile(userName)}
          style={{ marginLeft: 16 }}
        >
          プロフィール
        </button>

        <div className="user-info">
          <span className="avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="avatar-img" />
            ) : userName ? (
              userName[0].toUpperCase()
            ) : (
              "?"
            )}
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

        <button
          className="notify-button"
          onClick={async () => {
            await fetchNotifications();
            toggleNotifications();
          }}
        >
          🔔
          {unreadCount > 0 && (
            <span className="notify-badge">{unreadCount}</span>
          )}
        </button>
      </header>

      {showNotifications && (
        <NotificationsPanel
          notifications={notifications}
          onClose={toggleNotifications}
        />
      )}

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

          {view === "timeline" ? (
            <Timeline
              posts={posts}
              comments={comments}
              currentUserName={userName}
              onDelete={handleDelete}
              onLike={handleLike}
              onAddComment={handleAddComment}
              onUserClick={openProfile}
            />
          ) : (
            <ProfileView
              userName={profileUser}
              posts={posts}
              avatarUrl={profileUser === userName ? avatarUrl : null}
              onBack={backToTimeline}
              onChangeAvatar={
                profileUser === userName ? handleAvatarUpload : undefined
              }
            />
          )}
        </section>
      </main>
    </div>
  );
}

// =================================
// 通知パネル
// =================================
function NotificationsPanel({ notifications, onClose }) {
  if (!notifications.length) {
    return (
      <div className="notifications-panel">
        <div className="panel-header">
          <h3>通知</h3>
          <button onClick={onClose}>×</button>
        </div>
        <p>まだ通知はありません。</p>
      </div>
    );
  }

  return (
    <div className="notifications-panel">
      <div className="panel-header">
        <h3>通知</h3>
        <button onClick={onClose}>×</button>
      </div>
      <ul>
        {notifications.map((n) => (
          <li key={n.id} className={n.read ? "read" : "unread"}>
            <span className="kind">{n.kind === "like" ? "❤️" : "💬"}</span>
            <span className="text">
              <strong>{n.from_user}</strong>
              {n.kind === "like"
                ? " があなたの投稿にいいねしました"
                : " がコメントしました"}
              {n.body && <>: {n.body}</>}
            </span>
            <span className="time">
              {new Date(n.created_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =================================
// タイムライン & 投稿カード
// =================================
function Timeline({
  posts,
  comments,
  currentUserName,
  onDelete,
  onLike,
  onAddComment,
  onUserClick,
}) {
  if (!posts.length) {
    return <p>まだ投稿がありません。</p>;
  }

  return (
    <div className="timeline">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          comments={comments.filter((c) => c.post_id === post.id)}
          currentUserName={currentUserName}
          onDelete={onDelete}
          onLike={onLike}
          onAddComment={onAddComment}
          onUserClick={onUserClick}
        />
      ))}
    </div>
  );
}

function PostCard({
  post,
  comments,
  currentUserName,
  onDelete,
  onLike,
  onAddComment,
  onUserClick,
}) {
  const [commentText, setCommentText] = useState("");

  const submitComment = (e) => {
    e.preventDefault();
    onAddComment(post, commentText);
    setCommentText("");
  };

  return (
    <article className="post-card">
      <header className="post-header">
        <div className="post-avatar">
          {post.user_name ? post.user_name[0].toUpperCase() : "?"}
        </div>
        <div className="post-header-main">
          <button
            type="button"
            className="post-username-button"
            onClick={() => onUserClick && onUserClick(post.user_name)}
          >
            {post.user_name}
          </button>
          <div className="post-display-name">{post.user_name}</div>
        </div>

        {post.user_name === currentUserName && (
          <button
            className="post-delete-button"
            onClick={() => onDelete(post.id, post.user_name)}
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
        <div className="post-meta">
          <button className="like-button" onClick={() => onLike(post)}>
            ❤️ {post.likes ?? 0}
          </button>
          <time className="post-time">
            {new Date(post.created_at).toLocaleString()}
          </time>
        </div>

        <div className="comments">
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <strong>{c.user_name}</strong> {c.body}
            </div>
          ))}
        </div>

        <form className="comment-form" onSubmit={submitComment}>
          <input
            type="text"
            value={commentText}
            placeholder="コメントを追加..."
            onChange={(e) => setCommentText(e.target.value)}
          />
          <button type="submit">送信</button>
        </form>
      </div>
    </article>
  );
}

// =================================
// プロフィール画面
// =================================
function ProfileView({ userName, posts, avatarUrl, onBack, onChangeAvatar }) {
  if (!userName) {
    return (
      <div className="profile-view">
        <button onClick={onBack}>← タイムラインに戻る</button>
        <p>ユーザーが選択されていません。</p>
      </div>
    );
  }

  const userPosts = posts.filter((p) => p.user_name === userName);
  const totalLikes = userPosts.reduce((sum, p) => sum + (p.likes ?? 0), 0);

  return (
    <div className="profile-view">
      <button className="back-button" onClick={onBack}>
        ← タイムラインに戻る
      </button>

      <div className="profile-header">
        <div className="profile-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="avatar-img" />
          ) : (
            userName[0]?.toUpperCase() ?? "?"
          )}
        </div>
        <div className="profile-info">
          <h2>{userName}</h2>
          <div className="profile-stats">
            <span>投稿 {userPosts.length}</span>
            <span>合計いいね ❤️ {totalLikes}</span>
          </div>

          {onChangeAvatar && (
            <label className="avatar-upload">
              アイコンを変更
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onChangeAvatar(f);
                }}
                style={{ display: "none" }}
              />
            </label>
          )}
        </div>
      </div>

      <div className="profile-grid">
        {userPosts.map((post) => (
          <div key={post.id} className="profile-grid-item">
            <img src={post.image_url} alt={post.caption || ""} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
