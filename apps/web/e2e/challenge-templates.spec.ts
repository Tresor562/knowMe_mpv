import { expect, test, type Page } from '@playwright/test';

async function mockAuthenticatedUser(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('knowme_token', 'challenge-template-token');
  });
  await page.route('http://localhost:4000/users/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'creator-1',
        email: 'creator@knowme.test',
        username: 'creator',
        displayName: 'Creator'
      })
    });
  });
}

test('challenge suggestions prefill an editable draft and preserve explicit creation', async ({ page }) => {
  await mockAuthenticatedUser(page);
  await page.route('http://localhost:4000/challenges', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }

    const body = route.request().postDataJSON() as {
      title: string;
      description: string;
      questions: string[];
    };
    expect(body).toEqual({
      title: 'Notre connexion autour de anime',
      description: 'Un défi personnalisé basé sur votre intérêt commun pour anime.',
      questions: [
        'Qu’est-ce que je préfère dans anime ?',
        'Depuis quand anime m’intéresse-t-il vraiment ?',
        'Quelle expérience liée à anime aimerais-je vivre ensuite ?'
      ]
    });
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'challenge-created',
        title: body.title,
        description: body.description,
        status: 'DRAFT',
        questions: body.questions.map((prompt, index) => ({ id: `q-${index}`, prompt })),
        participants: []
      })
    });
  });
  await page.route('http://localhost:4000/intelligence/suggested-challenges', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          title: 'Notre connexion autour de anime',
          description: 'Un défi personnalisé basé sur votre intérêt commun pour anime.',
          questions: [
            'Qu’est-ce que je préfère dans anime ?',
            'Depuis quand anime m’intéresse-t-il vraiment ?',
            'Quelle expérience liée à anime aimerais-je vivre ensuite ?'
          ]
        }
      ])
    });
  });

  await page.goto('/challenges');
  await expect(page.getByRole('heading', { name: 'Des idées prêtes à personnaliser' })).toBeVisible();
  await page.getByRole('button', { name: 'Utiliser ce modèle' }).click();

  await expect(page.getByLabel('Titre du défi')).toHaveValue('Notre connexion autour de anime');
  await expect(page.getByLabel('Description du défi')).toHaveValue(
    'Un défi personnalisé basé sur votre intérêt commun pour anime.'
  );
  await expect(page.getByLabel('Questions du défi')).toHaveValue(
    [
      'Qu’est-ce que je préfère dans anime ?',
      'Depuis quand anime m’intéresse-t-il vraiment ?',
      'Quelle expérience liée à anime aimerais-je vivre ensuite ?'
    ].join('\n')
  );
  await expect(page.getByRole('status')).toContainText('Tu peux tout modifier');

  await page.getByRole('button', { name: 'Créer le défi' }).click();
  await page.waitForURL('**/challenges/challenge-created');
});

test('challenge creation stays available when suggestions are unavailable', async ({ page }) => {
  await mockAuthenticatedUser(page);
  await page.route('http://localhost:4000/challenges', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('http://localhost:4000/intelligence/suggested-challenges', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Suggestions unavailable' })
    });
  });

  await page.goto('/challenges');
  await expect(page.getByRole('button', { name: '+ Créer un défi' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Des idées prêtes à personnaliser' })).toHaveCount(0);
  await page.getByRole('button', { name: '+ Créer un défi' }).click();
  await expect(page.getByRole('heading', { name: 'Nouveau défi' })).toBeVisible();
});
