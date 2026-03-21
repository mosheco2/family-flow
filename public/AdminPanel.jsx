import React, { useState, useEffect } from 'react';
import { 
  Settings, Zap, Megaphone, Image as ImageIcon, Link as LinkIcon, Search, 
  ChevronDown, ChevronUp, Trash2, Users, LogOut, PartyPopper, Shield, Crown, Building2
} from 'lucide-react';

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

const AdminPanel = () => {
  // --- States ---
  const [token, setToken] = useState(localStorage.getItem('ofl_sa_token') || null);
  const [loginData, setLoginData] = useState({ code: '', password: '' });
  
  const [globalMessage, setGlobalMessage] = useState('');
  const [banners, setBanners] = useState({
    banner_top_text: '', banner_top_img: '', banner_top_link: '',
    banner_bottom_text: '', banner_bottom_img: '', banner_bottom_link: ''
  });

  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroup, setExpandedGroup] = useState(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // --- Helpers ---
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': token
  };

  // --- Data Fetching ---
  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // משיכת נתוני קבוצות ומשתמשים
      const resData = await fetch(`${API}/superadmin/data`, { headers: authHeaders });
      const data = await resData.json();
      
      if (data.error) {
        if (data.error === 'Invalid token') handleLogout();
        showToast(data.error, 'error');
        return;
      }
      
      setGroups(data.groups || []);
      setUsers(data.users || []);
      setGlobalMessage(data.welcomeMsg || '');

      // משיכת באנרים
      const resBanners = await fetch(`${API}/banners`);
      const bannersData = await resBanners.json();
      if (bannersData.success && bannersData.banners) {
        setBanners({
          banner_top_text: bannersData.banners.banner_top_text || '',
          banner_top_img: bannersData.banners.banner_top_img || '',
          banner_top_link: bannersData.banners.banner_top_link || '',
          banner_bottom_text: bannersData.banners.banner_bottom_text || '',
          banner_bottom_img: bannersData.banners.banner_bottom_img || '',
          banner_bottom_link: bannersData.banners.banner_bottom_link || ''
        });
      }
    } catch (err) {
      showToast('שגיאה בחיבור לשרת', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Actions ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/superadmin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        localStorage.setItem('ofl_sa_token', data.token);
        showToast('התחברת בהצלחה לניהול הראשי');
      } else {
        showToast(data.error || 'פרטים שגויים', 'error');
      }
    } catch (err) {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('ofl_sa_token');
  };

  const saveGlobalMessage = async () => {
    try {
      const res = await fetch(`${API}/superadmin/settings`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ welcomeMsg: globalMessage })
      });
      const data = await res.json();
      if (data.success) showToast('הודעת הפתיחה עודכנה בהצלחה!');
      else showToast('שגיאה בשמירת ההודעה', 'error');
    } catch (e) {
      showToast('שגיאת תקשורת', 'error');
    }
  };

  const saveBanners = async () => {
    try {
      const res = await fetch(`${API}/superadmin/banners`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          topText: banners.banner_top_text, topLink: banners.banner_top_link, topImg: banners.banner_top_img,
          bottomText: banners.banner_bottom_text, bottomLink: banners.banner_bottom_link, bottomImg: banners.banner_bottom_img
        })
      });
      const data = await res.json();
      if (data.success) showToast('הבאנרים עודכנו באפליקציה!');
      else showToast('שגיאה בשמירת הבאנרים', 'error');
    } catch (e) {
      showToast('שגיאת תקשורת', 'error');
    }
  };

  const togglePremium = async (groupId, enable) => {
    if (!window.confirm(`האם ${enable ? 'להפעיל' : 'לבטל'} מנוי Pro לסביבה זו?`)) return;
    try {
      const res = await fetch(`${API}/superadmin/groups/${groupId}/premium`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify({ enable })
      });
      const data = await res.json();
      if (data.success) {
        showToast(enable ? 'מנוי Pro הופעל בהצלחה!' : 'מנוי Pro בוטל');
        fetchDashboardData();
      } else showToast('שגיאה בעדכון המנוי', 'error');
    } catch (e) { showToast('שגיאת תקשורת', 'error'); }
  };

  const deleteGroup = async (groupId, name) => {
    if (!window.confirm(`אזהרה חמורה: האם למחוק את סביבת "${name}" לצמיתות? כל הנתונים יימחקו.`)) return;
    try {
      await fetch(`${API}/superadmin/groups/${groupId}`, { method: 'DELETE', headers: authHeaders });
      showToast('הסביבה נמחקה לחלוטין');
      fetchDashboardData();
    } catch (e) { showToast('שגיאה במחיקת הסביבה', 'error'); }
  };

  const deleteUser = async (userId, name) => {
    if (!window.confirm(`האם למחוק את המשתמש "${name}"?`)) return;
    try {
      await fetch(`${API}/superadmin/users/${userId}`, { method: 'DELETE', headers: authHeaders });
      showToast('משתמש נמחק');
      fetchDashboardData();
    } catch (e) { showToast('שגיאה במחיקת המשתמש', 'error'); }
  };

  // --- Render logic ---
  const filteredGroups = groups.filter(g => 
    (g.name && g.name.includes(searchTerm)) || 
    (g.group_code && g.group_code.includes(searchTerm))
  );

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">ONEFLOW 360</h1>
            <p className="text-slate-500">Super Admin Portal</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input 
                type="text" 
                placeholder="קוד גישה (Admin Code)"
                value={loginData.code}
                onChange={e => setLoginData({...loginData, code: e.target.value})}
                className="w-full bg-[#f4f7fa] border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-200 outline-none text-right"
                required
              />
            </div>
            <div>
              <input 
                type="password" 
                placeholder="סיסמה"
                value={loginData.password}
                onChange={e => setLoginData({...loginData, password: e.target.value})}
                className="w-full bg-[#f4f7fa] border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-200 outline-none text-right"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-slate-800 text-white rounded-2xl py-4 font-bold hover:bg-slate-700 transition disabled:opacity-50"
            >
              {isLoading ? 'מתחבר...' : 'כניסה למערכת'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full text-white font-bold text-sm shadow-lg transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center">
              <Settings size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg">מרכז השליטה העליון</h1>
              <p className="text-[10px] text-slate-400">Oneflow SuperAdmin</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition font-medium text-sm bg-slate-50 px-4 py-2 rounded-xl">
            <LogOut size={16} />
            התנתק
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Right Sidebar - System Tools */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Stats Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Zap size={18} className="text-orange-400" /> סקירה כללית
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#f4f7fa] p-4 rounded-2xl text-center">
                <span className="block text-2xl font-bold text-blue-600">{groups.length}</span>
                <span className="text-xs text-slate-500">סביבות (משפחות/עסקים)</span>
              </div>
              <div className="bg-[#f4f7fa] p-4 rounded-2xl text-center">
                <span className="block text-2xl font-bold text-purple-600">{users.length}</span>
                <span className="text-xs text-slate-500">משתמשי קצה</span>
              </div>
            </div>
          </div>

          {/* Global Message */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <PartyPopper size={18} className="text-pink-400" /> הודעת מערכת (Popup)
            </h2>
            <textarea 
              value={globalMessage}
              onChange={(e) => setGlobalMessage(e.target.value)}
              placeholder="הודעה שתקפוץ לכל משתמש בכניסה הראשונה..."
              className="w-full bg-[#f4f7fa] border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-200 outline-none resize-none h-24 mb-3 text-right"
            />
            <button onClick={saveGlobalMessage} className="w-full bg-blue-50 text-blue-600 font-bold py-3 rounded-xl hover:bg-blue-100 transition text-sm">
              עדכן הודעה
            </button>
          </div>

          {/* Banners */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Megaphone size={18} className="text-indigo-400" /> מערכת באנרים
            </h2>
            
            <div className="space-y-4">
              <div className="p-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <h3 className="text-xs font-bold text-slate-500 mb-3">באנר עליון (Top)</h3>
                <input type="text" value={banners.banner_top_text} onChange={e => setBanners({...banners, banner_top_text: e.target.value})} placeholder="טקסט לבאנר..." className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs mb-2 text-right" />
                <input type="text" value={banners.banner_top_img} onChange={e => setBanners({...banners, banner_top_img: e.target.value})} placeholder="נתיב תמונה (public/)" className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs mb-2 dir-ltr text-left" />
                <input type="text" value={banners.banner_top_link} onChange={e => setBanners({...banners, banner_top_link: e.target.value})} placeholder="קישור (URL)" className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs dir-ltr text-left" />
              </div>

              <div className="p-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <h3 className="text-xs font-bold text-slate-500 mb-3">באנר תחתון (Bottom)</h3>
                <input type="text" value={banners.banner_bottom_text} onChange={e => setBanners({...banners, banner_bottom_text: e.target.value})} placeholder="טקסט לבאנר..." className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs mb-2 text-right" />
                <input type="text" value={banners.banner_bottom_img} onChange={e => setBanners({...banners, banner_bottom_img: e.target.value})} placeholder="נתיב תמונה (public/)" className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs mb-2 dir-ltr text-left" />
                <input type="text" value={banners.banner_bottom_link} onChange={e => setBanners({...banners, banner_bottom_link: e.target.value})} placeholder="קישור (URL)" className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs dir-ltr text-left" />
              </div>
            </div>

            <button onClick={saveBanners} className="w-full mt-4 bg-indigo-50 text-indigo-600 font-bold py-3 rounded-xl hover:bg-indigo-100 transition text-sm">
              שמור ופרסם באנרים
            </button>
          </div>
        </div>

        {/* Main Content - Groups Manager */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm min-h-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                <Users size={24} className="text-blue-500" />
                סביבות ולקוחות (CRM)
              </h2>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <input 
                type="text" 
                placeholder="חיפוש קוד סביבה או שם..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#f4f7fa] border border-slate-100 rounded-2xl px-12 py-4 text-sm focus:ring-2 focus:ring-blue-200 outline-none text-right font-medium text-slate-600"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </div>

            {/* Groups List */}
            <div className="space-y-3">
              {isLoading && groups.length === 0 ? (
                <p className="text-center text-slate-400 py-10">טוען נתונים...</p>
              ) : filteredGroups.length === 0 ? (
                <p className="text-center text-slate-400 py-10">לא נמצאו תוצאות</p>
              ) : (
                filteredGroups.map(group => {
                  const groupUsers = users.filter(u => u.group_id === group.id);
                  const isExpanded = expandedGroup === group.id;
                  const isBusiness = group.type === 'BUSINESS';
                  const isPro = group.is_premium;
                  
                  return (
                    <div key={group.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:border-blue-100 transition">
                      {/* Group Header */}
                      <div 
                        className="p-4 cursor-pointer flex justify-between items-center bg-slate-50/50 hover:bg-slate-50"
                        onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm ${isBusiness ? 'bg-blue-500' : 'bg-purple-500'}`}>
                            {isBusiness ? <Building2 size={20} /> : <Users size={20} />}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                              {group.name}
                              {isPro && <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full"><Crown size={10} className="inline mr-1"/> PRO</span>}
                              {isBusiness && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full">עסק</span>}
                            </h3>
                            <div className="text-xs text-slate-500 font-mono mt-1">
                              קוד: {group.group_code} | {groupUsers.length} משתמשים
                            </div>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                      </div>

                      {/* Group Details (Expanded) */}
                      {isExpanded && (
                        <div className="p-4 border-t border-slate-100 bg-white">
                          <div className="flex flex-wrap gap-2 mb-4 justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div>
                              <span className="text-xs text-slate-500">אנרגיית AI נותרת:</span>
                              <span className="text-sm font-bold ml-2 text-slate-800">{isPro ? '∞ (ללא הגבלה)' : `${group.ai_tokens} טוקנים`}</span>
                            </div>
                            <div className="flex gap-2">
                              {isPro ? (
                                <button onClick={() => togglePremium(group.id, false)} className="bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-100 hover:bg-orange-100 transition">
                                  ביטול Pro
                                </button>
                              ) : (
                                <button onClick={() => togglePremium(group.id, true)} className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:opacity-90 transition flex items-center gap-1">
                                  <Crown size={12} /> הפעלת Pro
                                </button>
                              )}
                              <button onClick={() => deleteGroup(group.id, group.name)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100 transition flex items-center gap-1">
                                <Trash2 size={12} /> מחיקת סביבה
                              </button>
                            </div>
                          </div>

                          <h4 className="text-xs font-bold text-slate-400 mb-2 px-1">רשימת משתמשים ({groupUsers.length}):</h4>
                          {groupUsers.length === 0 ? (
                            <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg">אין משתמשים בסביבה זו.</p>
                          ) : (
                            <div className="space-y-2">
                              {groupUsers.map(u => (
                                <div key={u.id} className="flex justify-between items-center bg-[#f4f7fa] px-4 py-2 rounded-xl">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                                      <span className="text-[10px] font-bold">{u.nickname.charAt(0)}</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-700">{u.nickname}</span>
                                    <span className={`text-[10px] px-1.5 rounded ${u.role === 'ADMIN' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>{u.role}</span>
                                  </div>
                                  <button onClick={() => deleteUser(u.id, u.nickname)} className="text-red-400 hover:text-red-600 bg-white w-7 h-7 flex items-center justify-center rounded-lg shadow-sm border border-slate-100 transition">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPanel;
