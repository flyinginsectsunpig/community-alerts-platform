'use client';

import { useStore } from '@/lib/store';
import { TYPE_CONFIG, ALERT_LEVEL_COLOR, SEVERITY_LABELS, SEVERITY_COLORS } from '@/lib/constants';
import { useIncidentComments } from '@/hooks/useIncidentComments';
import { MapPin, Clock, Send, ShieldAlert, ChevronLeft, Radio, History } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * SuburbBrief Component
 */
export function SuburbBrief({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { suburbs, incidents, forumPosts, setForumPosts } = useStore();
  
  const suburb = suburbs.find(s => s.id === id);
  const suburbIncidents = incidents.filter(i => i.suburb === id).slice(0, 5);
  const posts = forumPosts[id] || [];
  const [newPost, setNewPost] = useState('');

  if (!suburb) return (
     <div className="p-10 text-center font-mono text-xs text-text-dim">
      Suburb ID {id} not found.
    </div>
  );

  const color = ALERT_LEVEL_COLOR[suburb.alertLevel ?? 'GREEN'];
  const pct = Math.min(100, (suburb.weight / 50) * 100);

  const addPost = () => {
    if (!newPost.trim()) return;
    const post = {
      user: 'You',
      avatar: '#f97316',
      time: 'Just now',
      text: newPost,
      likes: 0,
      liked: false
    };
    setForumPosts({ ...forumPosts, [id]: [post, ...posts] });
    setNewPost('');
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="p-6 pb-4 relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-accent" />
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-widest font-bold">Sector Radio</span>
          </div>
          <div 
             className="px-2 py-0.5 rounded-sm border font-mono text-[9px] uppercase tracking-widest font-bold"
             style={{ color, borderColor: `${color}40`, backgroundColor: `${color}10` }}
          >
            {suburb.alertLevel}
          </div>
        </div>

        <h1 className="font-display font-extrabold text-3xl text-text-primary leading-tight tracking-tight">
          {suburb.name.toUpperCase()}
        </h1>

        <div className="flex items-center gap-4 mt-2 font-mono text-[9px] text-text-dim uppercase tracking-[0.2em]">
           <span className="text-text-secondary">{suburb.lat.toFixed(4)}°S</span>
           <span className="w-1 h-1 bg-border rounded-full" />
           <span className="text-text-secondary">{suburb.lng.toFixed(4)}°E</span>
        </div>
      </div>

      <div className="px-6 py-6 border-y border-border bg-bg/40 grid grid-cols-2 gap-8">
        <div>
          <div className="flex justify-between items-end mb-2">
            <span className="font-mono text-[9px] text-text-dim uppercase tracking-widest font-bold text-text-secondary">Heat Score</span>
            <span className="font-mono text-xl font-bold" style={{ color }}>{suburb.weight}</span>
          </div>
          <div className="h-1.5 w-full bg-surface2 rounded-full overflow-hidden border border-white/5">
             <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        </div>
        <div className="flex flex-col justify-center gap-2">
           <div className="flex justify-between items-center text-[9px] font-mono uppercase tracking-widest">
              <span className="text-text-dim">Active Alerts</span>
              <span className="text-text-primary font-bold">{suburb.incidentCount ?? suburbIncidents.length}</span>
           </div>
           <div className="flex justify-between items-center text-[9px] font-mono uppercase tracking-widest">
              <span className="text-text-dim">Response Units</span>
              <span className="text-text-primary font-bold">DEP-4</span>
           </div>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History size={13} className="text-text-dim" />
            <h3 className="font-mono text-[10px] text-text-dim uppercase tracking-widest font-bold">Tactical Briefs</h3>
          </div>
          <span className="font-mono text-[8px] text-text-dim uppercase tracking-wider">Top 5 Recent</span>
        </div>
        <div className="flex flex-col gap-2">
          {suburbIncidents.map(inc => (
            <div 
              key={inc.id}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set('incident', String(inc.id));
                router.push(`/?${params.toString()}`);
              }}
              className="flex items-center gap-3 p-3 bg-surface2/50 border border-border rounded-lg hover:border-accent/40 cursor-pointer transition-all group"
            >
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: ALERT_LEVEL_COLOR[inc.severity >= 4 ? 'RED' : (inc.severity >= 3 ? 'ORANGE' : 'YELLOW')] }} />
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-xs truncate text-text-primary group-hover:text-accent transition-colors">
                  {inc.title}
                </div>
                <div className="flex items-center gap-2 mt-1">
                   <span className="font-mono text-[8px] text-text-dim uppercase">{inc.time}</span>
                   <span className="w-0.5 h-0.5 bg-border rounded-full" />
                   <span className="font-mono text-[8px] text-text-secondary uppercase">{inc.type}</span>
                </div>
              </div>
            </div>
          ))}
          {suburbIncidents.length === 0 && (
             <div className="text-[10px] font-mono text-text-dim italic py-4">No recent tactical briefs for this sector.</div>
          )}
        </div>
      </div>

      <div className="flex-1 border-t border-border flex flex-col bg-bg/20">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-mono text-[10px] text-text-dim uppercase tracking-[0.2em] font-bold">Frequency 94.2 MHZ</h3>
          <div className="flex items-center gap-1.5 text-green">
             <div className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
             <span className="font-mono text-[8px] uppercase tracking-widest font-bold">Channel Open</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {posts.map((post, i) => (
            <div key={i} className="flex gap-3 animate-fade-in">
              <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center font-mono text-[8px] text-text-dim flex-shrink-0 overflow-hidden shadow-sm">
                {post.avatar.startsWith('#') ? post.user.charAt(0) : <img src={post.avatar} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-text-primary font-bold">{post.user}</span>
                  <span className="font-mono text-[8px] text-text-dim uppercase">{post.time}</span>
                </div>
                <p className="font-body text-[13px] text-text-secondary bg-surface/50 rounded-r-lg rounded-bl-lg p-3 border border-border shadow-sm">
                   {post.text}
                </p>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <div className="text-center py-10 flex flex-col items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-surface2 flex items-center justify-center border border-border">
                  <Radio size={14} className="text-text-dim" />
               </div>
               <span className="font-mono text-[10px] text-text-dim uppercase tracking-widest">No signals detected...</span>
            </div>
          )}
        </div>

        <div className="p-4 bg-surface/80 border-t border-border backdrop-blur-sm">
          <div className="relative flex items-center">
            <input 
              value={newPost}
              onChange={e => setNewPost(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPost()}
              placeholder="Broadcast signal..."
              className="w-full bg-bg border border-border rounded-lg pl-4 pr-12 py-3 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all font-body"
            />
            <button 
              onClick={addPost}
              className="absolute right-2 p-2 text-accent hover:text-orange-500 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
