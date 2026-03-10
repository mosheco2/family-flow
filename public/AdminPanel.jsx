import React, { useState } from 'react';
import { 
  Settings, 
  Zap, 
  Megaphone, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Users,
  LogOut,
  PartyPopper
} from 'lucide-react';

const AdminPanel = () => {
  // --- States ---
  
  // הודעת פתיחה
  const [globalMessage, setGlobalMessage] = useState('ברוכים הבאים ל - ONEFLOW LIFE\nהמקום הנכון להתנהלות משפחתית נכונה :)');
  
  // באנרים
  const [banners, setBanners] = useState({
    top: {
      text: '',
      imagePath: 'banner1.png',
      link: '',
    },
    bottom: {
      text: '',
      imagePath: 'banner2.png',
      link: 'https://github.com/mosheco2/family-flow/blob',
    }
  });

  // משפחות (Mock Data)
  const [families, setFamilies] = useState([
    {
      id: 1,
      name: 'משפחה בהפרעה',
      code: '866STN',
      score: 10,
      members: [
        { id: 101, name: 'אבא', role: 'ADMIN' },
        { id: 102, name: 'אגם', role: 'MEMBER' }
      ]
    },
    {
      id: 2,
      name: 'משפחת כהן',
      code: '123ABC',
      score: 45,
      members: [
        { id: 201, name: 'אמא', role: 'ADMIN' },
        { id: 202, name: 'דני', role: 'MEMBER' }
      ]
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFamily, setExpandedFamily] = useState(1); // מזהה המשפחה הפתוחה כרגע

  // פעילות אחרונה (Mock Data)
  const recentActivities = [
    { id: 1, date: '10.3.2026, 10:17', family: 'משפחה בהפרעה', user: 'אבא', action: 'פתח/ה משפחה חדשה', type: 'registration' }
  ];

  // --- Handlers ---
  
  const handleBannerChange = (position, field, value) => {
    setBanners(prev => ({
      ...prev,
      [position]: {
        ...prev[position],
        [field]: value
      }
    }));
  };

  const deleteMember = (familyId, memberId) => {
    if(window.confirm('האם אתה בטוח שברצונך למחוק משתמש זה?')) {
        setFamilies(families.map(f => {
            if (f.id === familyId) {
                return { ...f, members: f.members.filter(m => m.id !== memberId) };
            }
            return f;
        }));
    }
  };

  const deleteFamily = (familyId) => {
    if(window.confirm('האם אתה בטוח שברצונך למחוק את כל המשפחה?')) {
        setFamilies(families.filter(f => f.id !== familyId));
    }
  };

  const filteredFamilies = families.filter(f => 
    f.name.includes(searchQuery) || f.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f4f7fa] p-4 md:p-8 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 flex justify-between items-center shadow-sm">
          <button className="bg-red-50 text-red-500 px-6 py-2 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center gap-2">
            התנתק
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-800">ניהול מערכת ראשי</h1>
            <Settings size={32} className="text-slate-800" />
          </div>
        </div>

        {/* Top Row: Activity & Global Message */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Recent Activity */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-end items-center gap-2 mb-6">
              <h2 className="text-xl font-bold text-slate-800">פעילות אחרונה במערכת</h2>
              <Zap className="text-yellow-400 fill-yellow-400" size={24} />
            </div>
            
            <div className="space-y-4">
              {recentActivities.map(activity => (
                <div key={activity.id} className="flex justify-between items-center border-b border-slate-50 pb-4 last:border-0">
                  <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                    הרשמה
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-slate-800 font-medium flex items-center justify-end gap-1">
                      {activity.date} | משפחת <span className="text-blue-600">{activity.family}</span> | {activity.user} <PartyPopper size={14} className="inline text-yellow-500" />
                    </div>
                    <div className="text-slate-500">{activity.action}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Global Message */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
            <div className="flex justify-end items-center gap-2 mb-2">
              <h2 className="text-xl font-bold text-slate-800">הודעת פתיחה גלובלית</h2>
              <Megaphone className="text-blue-500" size={24} />
            </div>
            <p className="text-right text-xs text-slate-400 mb-4">טקסט זה יופיע בפופ-אפ לכל משתמש שמתחבר למערכת. השאירו ריק כדי לבטל.</p>
            
            <textarea 
              value={globalMessage}
              onChange={(e) => setGlobalMessage(e.target.value)}
              className="w-full flex-1 min-h-[120px] bg-white border border-slate-200 rounded-2xl p-4 text-right text-sm resize-none focus:ring-2 focus:ring-blue-100 outline-none mb-4"
              dir="rtl"
            />
            
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors">
              שמור הודעה
            </button>
          </div>

        </div>

        {/* Banners Management */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
          <div className="flex justify-end items-center gap-2 mb-6">
            <h2 className="text-xl font-bold text-slate-800">ניהול באנרים פרסומיים (Top & Bottom)</h2>
            <span className="bg-pink-500 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">Ad</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <BannerSettingsCard 
              title="באנר עליון (Top Banner)"
              data={banners.top}
              onChange={(field, val) => handleBannerChange('top', field, val)}
            />
            <BannerSettingsCard 
              title="באנר תחתון (Bottom Banner)"
              data={banners.bottom}
              onChange={(field, val) => handleBannerChange('bottom', field, val)}
            />
          </div>

          <button className="w-full bg-[#eb4899] hover:bg-[#d43d86] text-white font-bold py-4 rounded-2xl text-lg transition-colors shadow-sm">
            שמור ופרסם באנרים במערכת
          </button>
        </div>

        {/* Families & Users Management */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div className="relative w-full md:w-80">
              <input 
                type="text"
                placeholder="חיפוש לפי קוד או שם משפחה..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#f4f7fa] border border-slate-100 rounded-full py-3 px-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 text-right"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </div>
            
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">משפחות ומשתמשים רשומים</h2>
              <Users className="text-blue-600" size={24} />
            </div>
          </div>

          <div className="space-y-4">
            {filteredFamilies.map(family => (
              <div key={family.id} className="border border-slate-100 rounded-2xl overflow-hidden transition-all">
                
                {/* Accordion Header */}
                <div 
                  className="bg-white p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedFamily(expandedFamily === family.id ? null : family.id)}
                >
                  <div className="text-slate-400">
                    {expandedFamily === family.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-slate-800">{family.name}</div>
                      <div className="text-xs text-slate-400 flex items-center justify-end gap-1">
                        קוד: {family.code} | <Zap size={12} className="text-yellow-500 fill-yellow-500" /> {family.score}
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                      <Users size={20} />
                    </div>
                  </div>
                </div>

                {/* Accordion Body */}
                {expandedFamily === family.id && (
                  <div className="bg-slate-50/50 p-4 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                      <button 
                        onClick={() => deleteFamily(family.id)}
                        className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-200 transition-colors"
                      >
                        <Trash2 size={14} /> מחק משפחה
                      </button>
                      <span className="text-sm font-bold text-slate-700">משתמשים:</span>
                    </div>
                    
                    <div className="space-y-2">
                      {family.members.map(member => (
                        <div key={member.id} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                          <button 
                            onClick={() => deleteMember(family.id, member.id)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div className="text-right flex items-center gap-1">
                            <span className="text-slate-400 text-xs">({member.role})</span>
                            <span className="font-medium text-slate-700">{member.name}</span>
                          </div>
                        </div>
                      ))}
                      {family.members.length === 0 && (
                        <div className="text-center text-slate-400 text-sm py-2">אין משתמשים במשפחה זו</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {filteredFamilies.length === 0 && (
              <div className="text-center py-8 text-slate-400">לא נמצאו משפחות תואמות לחיפוש</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// קומפוננטת עזר לכרטיס הגדרות באנר
const BannerSettingsCard = ({ title, data, onChange }) => (
  <div className="bg-[#fcfdff] border border-slate-100 rounded-3xl p-6">
    <h3 className="text-center font-bold text-slate-700 mb-6 pb-2 border-b border-slate-100">{title}</h3>
    
    <div className="space-y-5">
      {/* טקסט */}
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-2 text-right">טקסט להצגה:</label>
        <input 
          type="text"
          value={data.text}
          onChange={(e) => onChange('text', e.target.value)}
          placeholder="למשל: לחצו כאן להצטרפות לוואטסאפ שלנו"
          className="w-full bg-[#f4f7fa] border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-200 outline-none text-right"
        />
      </div>

      {/* תמונה */}
      <div>
        <label className="flex items-center justify-end gap-1 text-xs font-bold text-slate-400 mb-2">
          שם קובץ תמונה (בתיקיית public):
          <ImageIcon size={12} />
        </label>
        <input 
          type="text"
          value={data.imagePath}
          onChange={(e) => onChange('imagePath', e.target.value)}
          placeholder="למשל: banner1.png"
          className="w-full bg-[#f4f7fa] border border-slate-100 rounded-2xl px-4 py-3 text-sm font-mono text-slate-600 focus:ring-2 focus:ring-pink-200 outline-none dir-ltr text-left"
        />
      </div>

      {/* קישור */}
      <div>
        <label className="flex items-center justify-end gap-1 text-xs font-bold text-slate-400 mb-2">
          קישור (אופציונלי):
          <LinkIcon size={12} />
        </label>
        <input 
          type="text"
          value={data.link}
          onChange={(e) => onChange('link', e.target.value)}
          placeholder="https://..."
          className="w-full bg-[#f4f7fa] border border-slate-100 rounded-2xl px-4 py-3 text-sm text-blue-600 focus:ring-2 focus:ring-pink-200 outline-none dir-ltr text-left"
        />
      </div>
    </div>
  </div>
);

export default AdminPanel;
