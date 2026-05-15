function hueToColor(hue) {
  const map = [
    [0, 30, '#8B5A5A'],
    [30, 60, '#8B7A4A'],
    [60, 90, '#748B4A'],
    [90, 150, '#4A8B5A'],
    [150, 200, '#4A7A8B'],
    [200, 240, '#4A618B'],
    [240, 280, '#614A8B'],
    [280, 320, '#7A4A8B'],
    [320, 360, '#8B4A72'],
  ]
  hue = ((hue % 360) + 360) % 360
  for (const [min, max, color] of map) {
    if (hue >= min && hue < max) return color
  }
  return '#8B7A4A'
}

function getInitial(name) {
  if (!name) return '?'
  return name.charAt(0)
}

module.exports = { hueToColor, getInitial }
