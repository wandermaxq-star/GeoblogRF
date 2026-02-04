import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Sidebar from '../src/components/Sidebar';
import { LayoutProvider } from '../src/contexts/LayoutContext';
import { useContentStore } from '../src/stores/contentStore';
import { GuestProvider } from '../src/contexts/GuestContext';

// Простая тестовая обёртка, проверяет что по клику открывается planner
test('Sidebar opens planner and navigates to /planner', async () => {
  // Сбрасываем состояние стора
  useContentStore.setState({ leftContent: null, rightContent: 'posts' });

  const { getByText, getByRole } = render(
    <MemoryRouter initialEntries={["/"]}>
      <GuestProvider>
        <LayoutProvider>
          <Sidebar />
          <Routes>
            <Route path="/planner" element={<div data-testid="planner-page">PLANNER</div>} />
            <Route path="/" element={<div data-testid="home">HOME</div>} />
          </Routes>
        </LayoutProvider>
      </GuestProvider>
    </MemoryRouter>
  );

  // Кликаем по навигационному контейнеру, чтобы раскрыть сайдбар
  const sidebar = getByRole('navigation');
  fireEvent.click(sidebar);

  // Теперь кликаем по кнопке Планировщик (появится после раскрытия)
  const plannerBtn = getByText('Планировщик');
  fireEvent.click(plannerBtn);

  await waitFor(() => {
    // Проверяем состояние стора
    const s = useContentStore.getState();
    expect(s.leftContent).toBe('planner');
  });
});
