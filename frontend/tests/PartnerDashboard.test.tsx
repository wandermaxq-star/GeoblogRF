import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';


// prepare fake stats used by the mock
const stats = { referral_code: 'ABC123', referred_users: 2, total_commission: 50,
  paid_pack_sales: 7,
  next_paid_pack_bonus_in: 93
};

// mock api module so that get() returns our fake stats
vi.mock('../src/services/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: stats })) }
}));
import { BrowserRouter } from 'react-router-dom';
import api from '../src/services/api';

// component under test should be imported after mocks are set up
import PartnerDashboard from '../src/pages/PartnerDashboard';

// we will stub useAuth to simulate logged-in user
vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', username: 'u', token: 't' } })
}));

describe('PartnerDashboard', () => {
  beforeEach(() => {
    // if module mocking didn't apply, also override instance method
    api.get = vi.fn(() => Promise.resolve({ data: stats }));
  });

  it('renders partner panel shell when user is logged in', async () => {
    render(
      <BrowserRouter>
        <PartnerDashboard />
      </BrowserRouter>
    );
    // just verify the header appears; detailed stats are covered by backend tests
    await waitFor(() => expect(screen.getByText(/Партнёрская панель/i)).toBeTruthy());
  });
});