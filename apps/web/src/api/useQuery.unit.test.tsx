import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiProvider, useApi } from './ApiProvider.tsx';
import { useQuery } from './useQuery.ts';
import { createWebApi } from './webApi.ts';
import { deferred } from '../test/fetchStub.ts';

describe('private query clearing', () => {
  it('discards a read that resolves after logout cleared the cache', async () => {
    const pending = deferred<string>();
    let clear = () => {};
    let cacheSize = () => 0;
    function Probe() {
      const { cache } = useApi();
      clear = () => cache.clear();
      cacheSize = () => cache.size;
      const query = useQuery('private', () => pending.promise);
      return <span>{query.data ?? 'empty'}</span>;
    }
    render(<ApiProvider api={createWebApi()}><Probe /></ApiProvider>);
    await act(async () => { clear(); pending.resolve('private response'); await pending.promise; });
    await waitFor(() => expect(screen.getByText('empty')).toBeTruthy());
    expect(screen.queryByText('private response')).toBeNull();
    expect(cacheSize()).toBe(0);
  });
});
