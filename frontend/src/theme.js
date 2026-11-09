// Single source for Three.js material colours, derived from design tokens.
import tokens from './theme.tokens.json';

const prefersDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function sceneTheme(dark = prefersDark()) {
  const t = dark ? tokens.dark : tokens.light;
  return {
    background: t['surface-100'],
    roof: tokens.scene['roof-tile'],
    roofEdge: t['border-strong'],
    panel: tokens.scene['pv-cell'],
    panelFrame: tokens.scene['pv-frame'],
    panelHover: t['brand'],
    panelRemoved: t['border'],
    rail: tokens.scene['rail-metal'],
    grid: tokens.scene['grid-line'],
    ground: t['surface-200'],
    wall: tokens.scene['house-wall'],
    compass: t['danger'],
    danger: t['danger'],
    brand: t['brand'],
    dim: t['ink'],
    handle: tokens.scene['calib-marker'],
  };
}
