// source: server.js:9
const KH_SANITIZE_OPTIONS = {
    allowedTags: [
        'b','strong','i','em','u','s','mark',
        'p','div','h2','h3','h4','br','hr','blockquote',
        'ul','ol','li',
        'table','thead','tbody','tr','th','td',
        'a','img','span',
    ],
    allowedAttributes: {
        'a':   ['href','title'],
        'img': ['src','alt','width','height'],
        '*':   ['class'],
    },
    allowedSchemes: ['http','https','mailto'],
    allowedSchemesByTag: { img: ['http','https'] },
    // Drop style and id from every element (CSS injection / DOM collision prevention)
    disallowedTagsMode: 'discard',
};
