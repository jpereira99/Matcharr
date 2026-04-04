import { TeamLogo } from '@/components/TeamLogo';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { LeagueProfile, TeamChannel } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

function reasonVariant(reason: string): 'success' | 'warning' | 'danger' | 'muted' {
	const r = reason.toLowerCase();
	if (r.includes('error') || r.includes('fail')) return 'danger';
	if (r.includes('no match') || r.includes('outside')) return 'warning';
	if (r.includes('match') || r.includes('routed') || r.includes('switch')) return 'success';
	return 'muted';
}

export function ActivityLogPage() {
	const q = useQuery({ queryKey: ['logs'], queryFn: () => api.logs(200) });
	const channelsQ = useQuery({ queryKey: ['team-channels'], queryFn: api.listTeamChannels });
	const profilesQ = useQuery({ queryKey: ['profiles'], queryFn: api.listProfiles });
	const [search, setSearch] = useState('');

	const lookups = useMemo(() => {
		const tcById = new Map<number, TeamChannel>();
		for (const tc of channelsQ.data ?? []) tcById.set(tc.id, tc);
		const profileById = new Map<number, LeagueProfile>();
		for (const p of profilesQ.data ?? []) profileById.set(p.id, p);
		return { tcById, profileById };
	}, [channelsQ.data, profilesQ.data]);

	const filtered = useMemo(() => {
		if (!q.data) return [];
		if (!search.trim()) return q.data;
		const term = search.toLowerCase();
		return q.data.filter((row) => {
			const team = String(row.team_name ?? '').toLowerCase();
			const from = String(row.from_stream_name ?? '').toLowerCase();
			const to = String(row.to_stream_name ?? '').toLowerCase();
			const reason = String(row.reason ?? '').toLowerCase();
			return team.includes(term) || from.includes(term) || to.includes(term) || reason.includes(term);
		});
	}, [q.data, search]);

	if (q.isLoading)
		return (
			<div className='space-y-6'>
				<Skeleton className='h-8 w-48' />
				<Skeleton className='h-10 w-full max-w-sm' />
				<Skeleton className='h-96' />
			</div>
		);
	if (q.isError) return <div className='text-(--color-danger)'>Failed to load logs</div>;

	return (
		<div className='space-y-6'>
			<header>
				<h1 className='text-2xl font-extrabold tracking-tight font-heading'>Activity Log</h1>
				<p className='mt-1 text-sm text-(--color-muted)'>Stream switch attempts and outcomes.</p>
			</header>

			{/* Filter */}
			<div className='relative max-w-sm'>
				<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-muted)' />
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder='Filter by team, stream, or reason...'
					className='pl-9'
					inputSize='sm'
				/>
			</div>

			<Card>
				<CardTitle>
					Recent Events{' '}
					{filtered.length !== (q.data?.length ?? 0) && (
						<span className='text-sm font-normal text-(--color-muted)'>
							({filtered.length} of {q.data?.length})
						</span>
					)}
				</CardTitle>

				{filtered.length === 0 ? (
					<EmptyState
						icon={Activity}
						title='No events'
						description={search ? 'No log entries match your filter.' : 'No stream switch events have been recorded yet.'}
					/>
				) : (
					<div className='relative mt-5 ml-3 border-l-2 border-(--color-border) pl-6'>
						{filtered.map((row, i) => {
							const reason = String(row.reason ?? '');
							const tcId = row.team_channel_id as number | undefined;
							const tc = tcId != null ? lookups.tcById.get(tcId) : undefined;
							const profile = tc ? lookups.profileById.get(tc.league_profile_id) : undefined;
							return (
								<div key={i} className='relative pb-6 last:pb-0'>
									<span className='absolute -left-[33px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-(--color-border) bg-(--color-surface)'>
										<span className='h-1.5 w-1.5 rounded-full bg-(--color-accent)' />
									</span>

									<div className='flex flex-wrap items-center gap-2'>
										<span className='font-mono text-xs text-(--color-muted)'>{String(row.switched_at)}</span>
										{tc && profile && (
											<TeamLogo
												league={profile.espn_league}
												abbreviation={tc.espn_team_abbr}
												espnTeamId={tc.espn_team_id}
												teamName={tc.team_name}
												size={20}
											/>
										)}
										{String(row.team_name ?? '') && (
											<span className='text-sm font-medium text-(--color-foreground)'>{String(row.team_name)}</span>
										)}
									</div>

									<div className='mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs'>
										<span className='min-w-0 break-words text-(--color-muted)'>
											{String(row.from_stream_name ?? 'Empty Stream')}
										</span>
										<ArrowRight className='h-3 w-3 shrink-0 text-(--color-accent)' />
										<span className='min-w-0 break-words text-(--color-foreground)'>
											{String(row.to_stream_name ?? 'Empty Stream')}
										</span>
									</div>

									<div className='mt-1.5'>
										<Badge variant={reasonVariant(reason)}>{reason}</Badge>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</Card>
		</div>
	);
}
