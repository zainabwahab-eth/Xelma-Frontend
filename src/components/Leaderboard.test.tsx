import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Leaderboard from './Leaderboard';
import { leaderboardApi } from '../lib/api-client';
import { useWalletStore } from '../store/useWalletStore';

vi.mock('../lib/api-client', () => ({
  leaderboardApi: {
    getLeaderboard: vi.fn(),
  },
}));

vi.mock('../store/useWalletStore', async (importActual) => {
  const actual = await importActual<typeof import('../store/useWalletStore')>();
  return { ...actual, useWalletStore: vi.fn() };
});

const WALLET_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4AFLGFFL6VIP4SBGY6RXVO532LBW4DAZ4Q';
const OTHER_WALLET = 'GBHExampleAddressForTestingPurposesOnly1234567890ABCDE';

function setWalletState(publicKey: string | null) {
  const state = {
    publicKey,
    status: publicKey ? ('connected' as const) : ('idle' as const),
  };
  vi.mocked(useWalletStore).mockImplementation((selector: any) =>
    typeof selector === 'function' ? selector(state) : state,
  );
}

function renderLeaderboard() {
  return render(
    <MemoryRouter initialEntries={['/leaderboard']}>
      <Leaderboard />
    </MemoryRouter>,
  );
}

describe('Leaderboard sticky current-user row matching', () => {
  it('identifies the current user row by wallet address when row.id differs from the address', async () => {
    // id is a database id (1), userId is the wallet address; they differ.
    vi.mocked(leaderboardApi.getLeaderboard).mockResolvedValue([
      { id: 1, userId: WALLET_ADDRESS, username: 'Alice', xlm: 300 },
      { id: 2, userId: OTHER_WALLET, username: 'Bob', xlm: 200 },
    ] as never);
    setWalletState(WALLET_ADDRESS);

    renderLeaderboard();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());

    // Sticky summary should reflect the matched current user.
    expect(screen.getByText('Current wallet summary')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Rank #1')).toBeInTheDocument();
  });

  it('does not mark another wallet row as the current user', async () => {
    vi.mocked(leaderboardApi.getLeaderboard).mockResolvedValue([
      { id: 1, userId: OTHER_WALLET, username: 'Alice', xlm: 300 },
      { id: 2, userId: WALLET_ADDRESS, username: 'Bob', xlm: 200 },
    ] as never);
    setWalletState(WALLET_ADDRESS);

    renderLeaderboard();
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());

    // Bob (matching wallet) is the current user; Alice is not.
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Rank #2')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('handles missing wallet address without errors or false matches', async () => {
    setWalletState(null);
    vi.mocked(leaderboardApi.getLeaderboard).mockResolvedValue([
      { id: 1, userId: WALLET_ADDRESS, username: 'Alice', xlm: 300 },
    ] as never);

    renderLeaderboard();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());

    // No wallet connected -> unranked, no false current-user match.
    expect(screen.getByText('Unranked')).toBeInTheDocument();
  });

  it('matches existing sticky-row behavior when row id equals wallet address', async () => {
    vi.mocked(leaderboardApi.getLeaderboard).mockResolvedValue([
      { id: WALLET_ADDRESS, userId: WALLET_ADDRESS, username: 'Alice', xlm: 300 },
    ] as never);
    setWalletState(WALLET_ADDRESS);

    renderLeaderboard();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());

    expect(screen.getByText('Rank #1')).toBeInTheDocument();
  });
});
