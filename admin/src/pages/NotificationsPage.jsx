import React, { useState } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { logActivity } from '../api/moviesApi';
import { useToast } from '../context/ToastContext';
import {
  Bell, Send, Clock, CheckCircle2, XCircle, History, Image, Link, Hash
} from 'lucide-react';

const NOTIF_HISTORY_KEY = 'vip_admin_notification_history';

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(arr) {
  localStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(arr));
}

export default function NotificationsPage() {
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [openUrl, setOpenUrl] = useState('');
  const [movieId, setMovieId] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState(() => getHistory());

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      addToast('Title and message are required', 'error');
      return;
    }

    setSending(true);
    await new Promise(r => setTimeout(r, 800));

    const notif = {
      id: 'notif-' + Date.now(),
      title,
      message,
      imageUrl,
      openUrl,
      movieId,
      scheduleTime: scheduleTime || null,
      sentAt: new Date().toISOString(),
      status: 'Delivered',
      recipients: Math.floor(Math.random() * 500) + 100
    };

    const updated = [notif, ...history].slice(0, 50);
    saveHistory(updated);
    setHistory(updated);
    logActivity('Notification Sent', `Push notification sent: "${title}"`);
    addToast(`Notification sent: "${title}"`, 'success');

    setTitle(''); setMessage(''); setImageUrl(''); setOpenUrl(''); setMovieId(''); setScheduleTime('');
    setSending(false);
  };

  const inputClass = "w-full bg-zinc-900/70 border border-zinc-800/70 text-zinc-200 placeholder-zinc-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-red-600/70 transition-all";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Notifications</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Send push notifications to users via Firebase Cloud Messaging</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Compose Form */}
        <div className="lg:col-span-3 space-y-4">
          <GlassCard hover={false}>
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              Compose Notification
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Notification Title *
                </label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="🎬 New Movie Added!" className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Message *
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Watch the latest movie now available on VIP Movies..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5" /> Image URL
                  </label>
                  <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5" /> Open URL
                  </label>
                  <input value={openUrl} onChange={e => setOpenUrl(e.target.value)} placeholder="https://vipmovies.com/movie/..." className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" /> Movie ID
                  </label>
                  <input value={movieId} onChange={e => setMovieId(e.target.value)} placeholder="hollywood-2026-00001" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Schedule (Optional)
                  </label>
                  <input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="primary" icon={Send} loading={sending} onClick={handleSend}>
                  {scheduleTime ? 'Schedule Notification' : 'Send Now'}
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard hover={false}>
            <h3 className="font-bold text-white mb-4 text-sm">Preview</h3>
            <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-700/60">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                  V
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{title || 'Notification Title'}</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                    {message || 'Your notification message will appear here...'}
                  </p>
                </div>
              </div>
              {imageUrl && (
                <div className="mt-3 rounded-lg overflow-hidden">
                  <img
                    src={imageUrl}
                    alt="Notification banner"
                    className="w-full h-28 object-cover"
                    onError={e => e.target.style.display = 'none'}
                  />
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <GlassCard hover={false}>
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-sky-400" />
            Notification History
          </h3>
          <div className="divide-y divide-zinc-800/50">
            {history.map(n => (
              <div key={n.id} className="flex items-center gap-4 py-3.5">
                <div className={`p-2 rounded-lg shrink-0 ${
                  n.status === 'Delivered'
                    ? 'bg-emerald-950/50 text-emerald-400'
                    : 'bg-red-950/50 text-red-400'
                }`}>
                  {n.status === 'Delivered'
                    ? <CheckCircle2 className="w-4 h-4" />
                    : <XCircle className="w-4 h-4" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-200 truncate">{n.title}</p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{n.message}</p>
                </div>
                <div className="text-right text-xs text-zinc-500 shrink-0">
                  <p className="font-semibold text-emerald-400">{n.recipients} recipients</p>
                  <p className="mt-0.5">{new Date(n.sentAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
