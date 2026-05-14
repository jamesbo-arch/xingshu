// src/icons.jsx — line icons (2px stroke), 24px default
const Icon = ({ d, size = 22, stroke = 'currentColor', fill = 'none', strokeWidth = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
       strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path}/>) : <path d={d}/>}
  </svg>
);

const IconSearch = (p) => <Icon {...p} d={['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z','m21 21-4.3-4.3']}/>;
const IconFilter = (p) => <Icon {...p} d={['M3 6h18','M7 12h10','M10 18h4']}/>;
const IconHeart = ({ filled, size=20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled?'var(--like)':'none'} stroke={filled?'var(--like)':'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const IconBookmark = ({ filled, size=20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled?'var(--fav)':'none'} stroke={filled?'var(--fav)':'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconComment = (p) => <Icon {...p} d={['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z']}/>;
const IconShare = (p) => <Icon {...p} d={['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8','m16 6-4-4-4 4','M12 2v13']}/>;
const IconPen = (p) => <Icon {...p} d={['M12 19l7-7 3 3-7 7-3-3z','M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z','m2 2 7.586 7.586','M11 11l-2 2']}/>;
const IconChevron = ({ dir='left', size=20 }) => {
  const map = { left:'M15 18l-6-6 6-6', right:'M9 18l6-6-6-6', down:'M6 9l6 6 6-6', up:'M18 15l-6-6-6 6' };
  return <Icon d={map[dir]} size={size} strokeWidth={2}/>;
};
const IconClose = (p) => <Icon {...p} d={['M18 6 6 18','M6 6l12 12']} strokeWidth={2}/>;
const IconLock = (p) => <Icon {...p} d={['M5 11h14v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z','M8 11V7a4 4 0 1 1 8 0v4']}/>;
const IconUsers = (p) => <Icon {...p} d={['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M23 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75']}/>;
const IconEye = (p) => <Icon {...p} d={['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z','M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z']}/>;
const IconStar = ({ filled, size=14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled?'var(--gold)':'none'} stroke={filled?'var(--gold)':'currentColor'} strokeWidth="1.8" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>
  </svg>
);
const IconMore = (p) => <Icon {...p} d={['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2','M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2','M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2']} strokeWidth={2.5} fill="currentColor"/>;
const IconCheck = (p) => <Icon {...p} d={['M20 6 9 17l-5-5']} strokeWidth={2.5}/>;

Object.assign(window, {
  Icon, IconSearch, IconFilter, IconHeart, IconBookmark, IconComment,
  IconShare, IconPen, IconChevron, IconClose, IconLock, IconUsers,
  IconEye, IconStar, IconMore, IconCheck,
});
