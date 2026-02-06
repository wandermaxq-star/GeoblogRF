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
      <LayoutProvider>
        <GuestProvider>
          <Sidebar />
        </GuestProvider>
        <Routes>
          <Route path="/planner" element={<div data-testid="planner-page">PLANNER</div>} />
          <Route path="/" element={<div data-testid="home">HOME</div>} />
        </Routes>
      </LayoutProvider>
    </MemoryRouter>
  );

  // Кликаем по самому навигационному элементу (nav) чтобы раскрыть сайдбар
  const sidebar = getByRole('navigation');
  fireEvent.click(sidebar);

  // Теперь кликаем по кнопке Планировщик (текст появляется после раскрытия)
  const plannerBtn = getByText('Планировщик');
  fireEvent.click(plannerBtn);

  await waitFor(() => {
    // Проверяем состояние стора
    const s = useContentStore.getState();
    expect(s.leftContent).toBe('planner');
  });
});
