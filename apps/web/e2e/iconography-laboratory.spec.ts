import { test, expect } from '@playwright/test';

/** WCAG 2.x contrast check on colors as actually painted by Chromium. */
function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const values = color.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
    if (!values || values.length !== 3) throw new Error('Unable to read RGB color: ' + color);
    const linear = values.map(value => {
      const s = value / 255;
      return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
    });
    return .2126 * linear[0]! + .7152 * linear[1]! + .0722 * linear[2]!;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a,b)+.05) / (Math.min(a,b)+.05);
}

test('design laboratory exposes 79 original icons, supports semantic states and filtering', async ({ page }) => {
  await page.goto('/design/iconography');
  await expect(page.getByRole('heading', { name: /Laboratoire des pictogrammes|Iconography laboratory/ }))
    .toBeVisible();
  await expect(page.locator('[data-glyph]')).toHaveCount(79);
  await expect(page.getByRole('note')).toContainText(/simulés localement|simulated locally/);
  await page.getByRole('button', { name: 'heart', exact: true }).click();
  await page.getByRole('group', { name: /État de l’icône prévisualisée|Preview icon state/ })
    .getByRole('button', { name: 'selected' }).click();
  await expect(page.getByTestId('icon-lab-preview').locator('.km-state-icon'))
    .toHaveAttribute('data-icon-state', 'selected');
  await expect(page.getByTestId('icon-lab-preview').locator('[data-knowme-icon="heart"]'))
    .toBeVisible();
  await page.getByLabel(/Rechercher une icône|Search for an icon/).fill('fullscreen');
  await expect(page.locator('[data-glyph]')).toHaveCount(2);
  await page.getByLabel(/Rechercher une icône|Search for an icon/).clear();
  await page.getByRole('group', { name: /^(Catégorie|Category)$/ }).getByRole('button', { name: /Multimédia|Media/ }).click();
  await expect(page.locator('[data-glyph]')).not.toHaveCount(79);
  await expect(page.locator('[data-glyph="play"]')).toBeVisible();
  await expect(page.locator('[data-glyph="heart"]')).toHaveCount(0);
});

test('three real-vector gifts visibly open without making a purchase', async ({ page }) => {
  await page.goto('/design/iconography');
  const gifts = page.locator('.km-icon-lab-gift');
  await expect(gifts).toHaveCount(3);
  for (const name of ['aurora', 'cosmos', 'blossom']) {
    const gift = gifts.filter({ has: page.getByRole('heading', { name, exact: true }) });
    const art = gift.locator('.km-collectible');
    // The three models must never be just recolors of the same ribbon box.
    await expect(gift.locator('.km-collectible-emblem-' + name)).toHaveCount(1);
    await expect(art).toHaveAttribute('data-state', 'idle');
    await gift.getByRole('button', { name: /^(Ouvert|Opened)$/ }).click();
    await expect(art).toHaveAttribute('data-state', 'opened');
    await gift.getByRole('button', { name: /^(Acquis|Claimed)$/ }).click();
    await expect(art).toHaveAttribute('data-state', 'claimed');
    await expect(gift.locator('svg[role="img"]')).toBeVisible();
  }
  await expect(page.getByText(/Aucun achat, message ou événement serveur|No purchase, message or server event/))
    .toBeVisible();
});

test('reduced motion and 44px touch surfaces hold on compact mobile', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/design/iconography');
  const button = page.locator('[data-glyph="heart"]');
  const dimensions = await button.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(dimensions.width).toBeGreaterThanOrEqual(44);
  expect(dimensions.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: /Rejouer le mouvement|Replay motion/ }).click();
  await expect(page.getByTestId('icon-lab-preview').locator('.km-state-icon'))
    .toHaveAttribute('data-icon-state', 'idle');
  const animation = await page.getByTestId('icon-lab-preview')
    .locator('.km-state-icon > svg').evaluate(svg => getComputedStyle(svg).animationName);
  expect(animation).toBe('none');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test('brand comparison presents both logos without replacing the official asset', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/design/iconography');
  const section = page.getByRole('region', { name: /Comparaison du logo|Logo comparison/ });
  await expect(section.getByRole('img', { name: /Logo actuel de KnowMe|Current KnowMe logo/ })).toBeVisible();
  await expect(section.getByRole('img', { name: /Prototype vectoriel du logo KnowMe|True-vector logo draft/ })).toBeVisible();
  await expect(section.getByText(/Le prototype ne remplace pas le logo officiel|prototype does not replace the official logo/)).toBeVisible();
  await expect(section.locator('img[src="/brand/knowme-logo.svg"]')).toHaveCount(2);
  await expect(section.locator('img[src="/brand/knowme-logo-vector-prototype.svg"]')).toHaveCount(2);
  const slider = section.getByRole('slider', { name: /Pourcentage de comparaison du logo|Logo comparison percentage/ });
  const overlay = section.getByTestId('logo-vector-reveal');
  await expect(slider).toHaveValue('50');
  await expect(slider).toHaveAttribute('aria-valuetext', /50% du prototype vectoriel visible|50% of the vector prototype revealed/);
  await expect(section.getByTestId('logo-comparison')).toHaveAttribute('aria-hidden', 'true');
  await expect(overlay).toHaveCSS('clip-path', 'inset(0px 50% 0px 0px)');
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(slider).toHaveValue('0');
  await expect(overlay).toHaveCSS('clip-path', 'inset(0px 100% 0px 0px)');
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('100');
  await expect(overlay).toHaveCSS('clip-path', 'inset(0px 0% 0px 0px)');
  const control = await slider.boundingBox();
  expect(control && control.height >= 44).toBeTruthy();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
});


test('design QA theme and motion controls are isolated from app preferences', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/design/iconography');
  const lab = page.locator('#knowme-iconography-lab');
  const theme = page.getByRole('group', { name: /Thème du laboratoire|Laboratory theme/ });
  const originalRootTheme = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme'));
  for (const [name, value] of [[/Clair|Light/,'light'], [/Sombre|Dark/,'dark'], [/AMOLED/,'amoled']] as const) {
    await theme.getByRole('button', { name }).click();
    await expect(lab).toHaveAttribute('data-lab-theme', value);
    await expect(theme.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    const paints = await lab.evaluate(node => ({
      foreground: getComputedStyle(node).color,
      background: getComputedStyle(node.querySelector('.km-icon-lab-panel')!).backgroundColor
    }));
    expect(contrastRatio(paints.foreground, paints.background))
      .toBeGreaterThanOrEqual(4.5);
  }
  const size = page.getByRole('slider', { name: /Taille du pictogramme|Glyph size/ });
  await size.focus();
  await page.keyboard.press('End');
  await expect(page.getByTestId('icon-lab-preview').locator('.km-state-icon'))
    .toHaveCSS('width', '72px');
  const motion = page.getByRole('checkbox', { name: /Animer les démonstrations|Animate previews/ });
  await motion.uncheck();
  await expect(lab).toHaveAttribute('data-lab-motion', 'off');
  // The local switch must reach React components, not merely suppress CSS:
  // active states and claimed gifts must also stop scheduling JS bursts.
  const states = page.getByRole('group', { name: /État de l’icône prévisualisée|Preview icon state/ });
  await states.getByRole('button', { name: 'loading' }).click();
  const symbol = page.getByTestId('icon-lab-preview').locator('.km-state-icon');
  await expect(symbol).toHaveAttribute('data-auto-motion', 'false');
  await page.getByRole('button', { name: /Rejouer le mouvement|Replay motion/ }).click();
  await expect(symbol).not.toHaveAttribute('data-icon-burst', /.+/);
  await expect(symbol.locator('svg').first()).toHaveCSS('animation-name', 'none');
  const aurora = page.locator('.km-icon-lab-gift').filter({
    has: page.getByRole('heading', { name: 'aurora', exact: true })
  });
  await aurora.getByRole('button', { name: /^(Acquis|Claimed)$/ }).click();
  await expect(aurora.locator('.km-collectible')).toHaveAttribute('data-state', 'claimed');
  await expect(aurora.locator('.km-collectible')).toHaveAttribute('data-burst', 'false');
  await motion.check();
  await expect(lab).toHaveAttribute('data-lab-motion', 'on');
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toEqual(originalRootTheme);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
    .toBe(false);
});


test('every one of the 79 vector icons draws nonempty geometry at phone and desktop widths', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/design/iconography');
    const glyphs = page.locator('.km-icon-lab-glyph');
    await expect(glyphs).toHaveCount(79);
    const geometry = await glyphs.evaluateAll(buttons => buttons.map(button => {
      const svg = button.querySelector('svg[data-knowme-icon]');
      if (!(svg instanceof SVGSVGElement)) {
        return { name: button.getAttribute('data-glyph'), invalid: 'missing svg' };
      }
      const box = svg.getBBox();
      const area = button.getBoundingClientRect();
      const primitives = svg.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse');
      const valid =
        svg.getAttribute('viewBox') === '0 0 24 24' &&
        svg.getAttribute('aria-hidden') === 'true' &&
        !!primitives.length &&
        [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
        box.width > 0 && box.height > 0 &&
        box.x >= -2 && box.y >= -2 &&
        box.x + box.width <= 26 && box.y + box.height <= 26 &&
        area.width >= 44 && area.height >= 44;
      return { name: button.getAttribute('data-glyph'), valid,
        bounds: [box.x, box.y, box.width, box.height], primitives: primitives.length,
        target: [area.width, area.height] };
    }));
    const failures = geometry.filter(item => !item.valid);
    expect(failures, 'Every glyph must have visible bounded artwork and accessible touch target').toEqual([]);
  }
});
