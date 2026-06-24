# UI Design & Styling

## Theme
Dark mode only. TradingView/Robinhood-inspired aesthetic.

## Color Palette

| Usage | Color | Hex |
|---|---|---|
| Background | Deep black | `#121214` |
| Cards/Containers | Dark charcoal | `#1f2937` |
| Borders | Gray | `border-gray-700/50` |
| Profit/Bullish/BUY | Emerald green | `#10B981` (Tailwind `emerald-400/500/600`) |
| Loss/Bearish/SELL | Rose red | `#EF4444` (Tailwind `rose-500`) |
| Neutral text | Gray | `text-gray-400` |
| Warning/RSI mid | Yellow | `text-yellow-400` |
| Links (TradingView) | Blue | `bg-blue-600/20 text-blue-400` |
| Links (Chartink) | Purple | `bg-purple-600/20 text-purple-400` |

## CSS (style.css)
Minimal custom CSS:
- Dark scrollbar styling
- Date input calendar icon inversion
- Table row hover transitions
- `.lookup-loading` pulse animation

Everything else uses Tailwind utility classes via CDN.

## Tailwind Config (inline in index.html)
```js
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: { 900: '#121214', 800: '#1f2937', 700: '#2d3748' }
      }
    }
  }
}
```

## Layout Pattern
- Max width: `max-w-[1600px]` centered
- Cards: `bg-[#1f2937] rounded-xl p-5/6 border border-gray-700/50`
- Tables: Full-width, `text-sm`, sticky headers with `bg-gray-900`
- Buttons: Rounded-lg, font-semibold, color-coded by action

## Interactive Elements
- **Transaction panel**: Fixed left slide-out (`transform -translate-x-full` toggle) with backdrop overlay
- **User switcher**: Absolute-positioned dropdown popover from avatar button
- **Ticker autocomplete**: `<ul>` dropdown below input, populated by Yahoo search
- **Sort indicators**: Click column headers, `▲`/`▼` arrows
- **Toast notifications**: Top-right, auto-dismiss after 3.5s, color-coded (green/red/yellow)
- **CSV import modal**: Full-screen overlay with preview table + confirm
