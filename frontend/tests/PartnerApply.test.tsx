import { render, screen, fireEvent } from '@testing-library/react';
import axios from 'axios';
import PartnerApply from '../src/pages/PartnerApply';

jest.mock('axios');
const mocked = axios as jest.Mocked<typeof axios>;

describe('PartnerApply page', () => {
  test('renders form and submits', async () => {
    mocked.post.mockResolvedValue({ data: { ok: true } });
    render(<PartnerApply />);

    const nameInput = screen.getByLabelText(/Никнейм/i);
    const aboutInput = screen.getByLabelText(/О себе/i);
    const button = screen.getByRole('button', { name: /Отправить заявку/i });

    fireEvent.change(nameInput, { target: { value: 'test' } });
    fireEvent.change(aboutInput, { target: { value: 'about' } });
    fireEvent.click(button);

    expect(await screen.findByText(/Заявка отправлена/i)).toBeInTheDocument();
  });
});
