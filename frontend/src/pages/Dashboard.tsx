import { LeagueBadge } from '@/components/LeagueBadge';
import { TeamLogo } from '@/components/TeamLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot } from '@/components/ui/status-dot';
import { api } from '@/lib/api';
import { fmtDateTime, fmtDateTimeSec } from '@/lib/date';
import type { LeagueProfile, TeamChannel } from '@/lib/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowRight, ChevronDown, ChevronRight, Clock, Radio, RefreshCw, Route, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const previewStatusLabel: Record<string, string> = {
	stream_found: 'Stream matched',
	no_stream_match: 'No stream match',
	no_active_game: 'No game in cache',
	outside_window: 'Outside window',
	pattern_error: 'Pattern error',
	dispatcharr_error: 'Dispatcharr error',
};

const previewStatusVariant: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
	stream_found: 'success',
	no_stream_match: 'warning',
	no_active_game: 'muted',
	outside_window: 'muted',
	pattern_error: 'danger',
	dispatcharr_error: 'danger',
};

/** ESPN `status.type.state` from scoreboard API */
const espnScheduleStateLabel: Record<string, string> = {
	pre: 'Scheduled',
	in: 'Live',
	post: 'Ended',
	cancelled: 'Canceled',
	canceled: 'Canceled',
	postponed: 'Postponed',
	delayed: 'Delayed',
	suspended: 'Suspended',
};

function formatScheduleGameStatus(status: string | undefined): string {
	if (status == null || status === '') return '—';
	return espnScheduleStateLabel[status] ?? status;
}

type Lookups = {
	tcById: Map<number, TeamChannel>;
	profileById: Map<number, LeagueProfile>;
};

function buildLookups(channels: TeamChannel[] | undefined, profiles: LeagueProfile[] | undefined): Lookups {
	const tcById = new Map<number, TeamChannel>();
	for (const tc of channels ?? []) tcById.set(tc.id, tc);
	const profileById = new Map<number, LeagueProfile>();
	for (const p of profiles ?? []) profileById.set(p.id, p);
	return { tcById, profileById };
}

function TeamLogoFromChannel({
	tc,
	profile,
	size = 28,
}: {
	tc: TeamChannel | undefined;
	profile: LeagueProfile | undefined;
	size?: number;
}) {
	if (!tc || !profile) return null;
	return (
		<TeamLogo
			league={profile.espn_league}
			abbreviation={tc.espn_team_abbr}
			espnTeamId={tc.espn_team_id}
			teamName={tc.team_name}
			size={size}
		/>
	);
}

/** Logos for schedule rows: uses ESPN team ids from the cache (works for every team, not only mapped channels). */
function TeamLogoFromSchedule({
	profile,
	espnTeamId,
	teamName,
	size = 20,
}: {
	profile: LeagueProfile | undefined;
	espnTeamId: string;
	teamName: string;
	size?: number;
}) {
	if (!profile || !espnTeamId.trim()) return null;
	return <TeamLogo league={profile.espn_league} abbreviation='' espnTeamId={espnTeamId} teamName={teamName} size={size} />;
}

function CachedGameCard({ g, highlighted, lookups }: { g: Record<string, unknown>; highlighted: boolean; lookups: Lookups }) {
	const tracked = (g.tracked_team_names as string[] | undefined) ?? [];
	const lpId = g.league_profile_id as number | undefined;
	const profile = lpId != null ? lookups.profileById.get(lpId) : undefined;
	const homeId = String(g.home_team_id ?? '');
	const awayId = String(g.away_team_id ?? '');
	const awayName = String(g.away_team ?? '');
	const homeName = String(g.home_team ?? '');

	const nameTracked = (name: string) => highlighted && tracked.some((t) => t.trim().toLowerCase() === name.trim().toLowerCase());
	const awayTracked = nameTracked(awayName);
	const homeTracked = nameTracked(homeName);

	return (
		<div className='flex items-center gap-3 rounded-(--radius-md) border border-(--color-border) bg-(--color-surface-raised)/50 px-4 py-3 transition-colors'>
			<div className='min-w-0 flex-1'>
				<div className='flex items-center justify-between gap-2'>
					<div className='flex items-center gap-2 min-w-0'>
						<TeamLogoFromSchedule profile={profile} espnTeamId={awayId} teamName={awayName} size={20} />
						<span className='truncate text-sm font-medium text-(--color-foreground)'>
							<span className={awayTracked ? 'text-(--color-accent)' : undefined}>{awayName}</span>
							<span> @ </span>
							<span className={homeTracked ? 'text-(--color-accent)' : undefined}>{homeName}</span>
						</span>
						<TeamLogoFromSchedule profile={profile} espnTeamId={homeId} teamName={homeName} size={20} />
					</div>
					{profile ? (
						<LeagueBadge league={profile.espn_league} label={String(g.league ?? '')} className='shrink-0' />
					) : (
						<Badge variant='muted'>{String(g.league ?? '')}</Badge>
					)}
				</div>
				<div className='mt-1 flex items-center gap-3 text-xs text-(--color-muted)'>
					<span>{fmtDateTime(g.game_time as string | undefined) ?? '—'}</span>
					<span className='text-(--color-muted)'>|</span>
					<span>{formatScheduleGameStatus(g.status as string | undefined)}</span>
				</div>
			</div>
		</div>
	);
}

function DashboardSkeleton() {
	return (
		<div className='space-y-8'>
			<div className='flex justify-between'>
				<div>
					<Skeleton className='h-8 w-48' />
					<Skeleton className='mt-2 h-4 w-72' />
				</div>
				<div className='flex gap-2'>
					<Skeleton className='h-9 w-36' />
					<Skeleton className='h-9 w-36' />
				</div>
			</div>
			<div className='grid gap-4 md:grid-cols-3'>
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className='h-28' />
				))}
			</div>
			<Skeleton className='h-64' />
		</div>
	);
}

export function DashboardPage() {
	const qc = useQueryClient();
	const [expandedLeagues, setExpandedLeagues] = useState<Set<number>>(() => new Set());
	const [showPreview, setShowPreview] = useState(false);

	const q = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });
	const channelsQ = useQuery({ queryKey: ['team-channels'], queryFn: api.listTeamChannels });
	const profilesQ = useQuery({ queryKey: ['profiles'], queryFn: api.listProfiles });
	const preview = useMutation({ mutationFn: api.routingPreview });
	const run = useMutation({
		mutationFn: api.runNow,
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ['dashboard'] });
			void qc.invalidateQueries({ queryKey: ['upcoming-stream-matches'] });
			preview.reset();
		},
	});
	const streamMatches = useQuery({
		queryKey: ['upcoming-stream-matches'],
		queryFn: api.upcomingStreamMatches,
		retry: false,
	});

	const lookups = useMemo(() => buildLookups(channelsQ.data, profilesQ.data), [channelsQ.data, profilesQ.data]);

	if (q.isLoading) return <DashboardSkeleton />;
	if (q.isError) return <div className='text-(--color-danger)'>Failed to load dashboard</div>;

	const d = q.data!;
	const reachable = d.health?.dispatcharr_reachable as boolean | null | undefined;
	return (
		<div className='space-y-6'>
			{/* Header */}
			<header className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
				<div>
					<h1 className='text-2xl font-extrabold tracking-tight font-heading'>Dashboard</h1>
					<p className='mt-1 text-sm text-(--color-muted)'>Live routing status, upcoming games, and recent stream switches.</p>
				</div>
				<div className='flex flex-wrap gap-2'>
					<Button
						type='button'
						variant='ghost'
						size='sm'
						onClick={() => {
							preview.mutate();
							setShowPreview(true);
						}}
						disabled={preview.isPending}
					>
						<Route className='h-3.5 w-3.5' />
						{preview.isPending ? 'Checking...' : 'Check Routing'}
					</Button>
					<Button type='button' size='sm' onClick={() => run.mutate()} disabled={run.isPending}>
						<Zap className='h-3.5 w-3.5' />
						{run.isPending ? 'Running...' : 'Run Match Now'}
					</Button>
				</div>
			</header>

			{/* Run result banner */}
			{run.isSuccess && run.data && (
				<div
					className={`rounded-(--radius-md) border px-4 py-3 text-sm ${
						run.data.ok
							? 'border-(--color-success)/30 bg-(--color-success)/10 text-(--color-success)'
							: 'border-(--color-warning)/30 bg-(--color-warning)/10 text-(--color-warning)'
					}`}
				>
					{run.data.message}
				</div>
			)}
			{run.isError && (
				<div className='rounded-(--radius-md) border border-(--color-danger)/30 bg-(--color-danger)/10 px-4 py-3 text-sm text-(--color-danger)'>
					{(run.error as Error)?.message ?? 'Run failed'}
				</div>
			)}

			{/* Status strip */}
			<div className='grid gap-4 md:grid-cols-3'>
				<Card className='relative overflow-hidden'>
					<div className='flex items-center gap-2 text-(--color-muted)'>
						<Radio className='h-4 w-4' />
						<span className='text-xs font-semibold uppercase tracking-wide'>Dispatcharr</span>
						<StatusDot
							status={
								!d.dispatcharr_configured
									? 'offline'
									: reachable === true
										? 'online'
										: reachable === false
											? 'offline'
											: 'warning'
							}
							className='ml-auto'
						/>
					</div>
					<div className='mt-3 text-xl font-semibold tabular-nums'>
						{!d.dispatcharr_configured ? (
							<span className='text-(--color-danger)'>Not configured</span>
						) : reachable === true ? (
							<span className='text-(--color-success)'>Connected</span>
						) : reachable === false ? (
							<span className='text-(--color-warning)'>Unreachable</span>
						) : (
							<span className='text-(--color-muted)'>Unknown</span>
						)}
					</div>
					<p className='mt-2 text-xs text-(--color-muted)'>
						{d.dispatcharr_configured ? (
							<>
								API {reachable === true ? 'responded OK' : reachable === false ? 'did not respond' : 'not checked'}.{' '}
								<Link to='/settings' className='text-(--color-accent) hover:underline'>
									Settings
								</Link>
							</>
						) : (
							<>
								Set URL + token in{' '}
								<Link to='/settings' className='text-(--color-accent) hover:underline'>
									Settings
								</Link>
								.
							</>
						)}
					</p>
				</Card>

				<Card>
					<div className='flex items-center gap-2 text-(--color-muted)'>
						<Activity className='h-4 w-4' />
						<span className='text-xs font-semibold uppercase tracking-wide'>Tracked Teams</span>
					</div>
					<div className='mt-3 text-3xl font-bold tabular-nums'>{d.tracked_teams}</div>
					<p className='mt-2 text-xs text-(--color-muted)'>
						{d.tracked_teams === 0 ? (
							<>
								Add teams in{' '}
								<Link to='/teams' className='text-(--color-accent) hover:underline'>
									Team Channels
								</Link>
								.
							</>
						) : (
							'Enabled team channel mappings.'
						)}
					</p>
				</Card>

				<Card>
					<div className='flex items-center gap-2 text-(--color-muted)'>
						<Clock className='h-4 w-4' />
						<span className='text-xs font-semibold uppercase tracking-wide'>Scheduler</span>
						<StatusDot status={d.health?.scheduler_running ? 'online' : 'warning'} className='ml-auto' />
					</div>
					<div className='mt-3 grid grid-cols-1 gap-4 text-xs text-(--color-muted) sm:grid-cols-2 sm:gap-x-6'>
						<div className='min-w-0 space-y-0.5'>
							<div className='text-[10px] font-semibold uppercase tracking-wide'>Stream Matching</div>
							<div>Next: {fmtDateTimeSec(d.next_scan_at) ?? '—'}</div>
							<div>Last: {fmtDateTimeSec(d.health?.last_scan_at as string | undefined) ?? '—'}</div>
						</div>
						<div className='min-w-0 space-y-0.5'>
							<div className='text-[10px] font-semibold uppercase tracking-wide'>ESPN Cache</div>
							<div>Next: {fmtDateTimeSec(d.health?.next_schedule_refresh_at as string | undefined) ?? '—'}</div>
							<div>Last: {fmtDateTimeSec(d.health?.last_schedule_refresh as string | undefined) ?? '—'}</div>
						</div>
					</div>
				</Card>
			</div>

			{/* Routing Preview (expandable) */}
			{showPreview && (preview.data != null || preview.isError) && (
				<Card>
					<div className='flex items-center justify-between'>
						<CardTitle>Routing Preview</CardTitle>
						<Button
							type='button'
							variant='ghost'
							size='sm'
							onClick={() => {
								setShowPreview(false);
								preview.reset();
							}}
						>
							Dismiss
						</Button>
					</div>
					{preview.isError && (
						<p className='mt-2 text-sm text-(--color-danger)'>{(preview.error as Error)?.message ?? 'Preview failed'}</p>
					)}
					{preview.data && (
						<>
							<p className='mt-1 text-xs text-(--color-muted)'>{preview.data.message}</p>
							<div className='mt-4 space-y-2'>
								{preview.data.items?.map((row) => {
									const tc = lookups.tcById.get(row.team_channel_id);
									const profile = lookups.profileById.get(row.league_profile_id);
									return (
										<div
											key={row.team_channel_id}
											className='flex items-center gap-3 rounded-(--radius-md) border border-(--color-border) bg-(--color-surface-raised)/50 px-4 py-2.5'
										>
											<TeamLogoFromChannel tc={tc} profile={profile} size={28} />
											<div className='min-w-0 flex-1'>
												<div className='flex items-center justify-between gap-2'>
													<span className='text-sm font-medium'>{row.team_name}</span>
													<Badge variant={previewStatusVariant[row.status] ?? 'muted'}>
														{previewStatusLabel[row.status] ?? row.status}
													</Badge>
												</div>
												{row.next_game && <div className='mt-1 text-xs text-(--color-muted)'>{row.next_game}</div>}
												{row.matched_stream_name && (
													<div className='mt-1 font-mono text-xs text-(--color-success)'>
														{row.matched_stream_name}
													</div>
												)}
												<div className='mt-0.5 text-xs text-(--color-muted)'>{row.reason}</div>
											</div>
										</div>
									);
								})}
							</div>
						</>
					)}
				</Card>
			)}

			{/* Main 2-column area */}
			<div className='grid gap-6 lg:grid-cols-[3fr_2fr]'>
				{/* Left: Upcoming Streams */}
				<Card>
					<div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
						<div className='min-w-0'>
							<CardTitle>Upcoming Streams</CardTitle>
							<p className='mt-1 text-xs text-(--color-muted)'>
								Check the next game for your tracked teams and stream matching status.
							</p>
						</div>
						<Button
							type='button'
							variant='ghost'
							size='sm'
							className='shrink-0'
							onClick={() => void streamMatches.refetch()}
							disabled={streamMatches.isFetching}
						>
							<RefreshCw className={`h-3.5 w-3.5 ${streamMatches.isFetching ? 'animate-spin' : ''}`} />
							Refresh
						</Button>
					</div>

					{streamMatches.isError && (
						<p className='mt-3 text-sm text-(--color-danger)'>
							{(streamMatches.error as Error)?.message ?? 'Could not load stream matches'}
						</p>
					)}
					{streamMatches.data && !streamMatches.data.ok && (
						<p className='mt-3 text-sm text-(--color-warning)'>{streamMatches.data.message}</p>
					)}

					{streamMatches.data?.ok && (
						<div className='mt-4 space-y-2'>
							{streamMatches.data.items.map((row) => {
								const tc = lookups.tcById.get(row.team_channel_id);
								const profile = lookups.profileById.get(row.league_profile_id);
								return (
									<div
										key={row.team_channel_id}
										className='flex items-start gap-3 rounded-(--radius-md) border border-(--color-border) bg-(--color-surface-raised)/30 px-4 py-3'
									>
										<TeamLogoFromChannel tc={tc} profile={profile} size={32} />
										<div className='min-w-0 flex-1'>
											<div className='flex items-center justify-between gap-2'>
												<span className='text-sm font-medium'>{row.team_name}</span>
												{row.status === 'no_upcoming_game' ||
												row.status === 'pattern_error' ||
												row.status === 'dispatcharr_error' ? (
													<Badge variant={previewStatusVariant[row.status] ?? 'muted'}>
														{previewStatusLabel[row.status] ?? row.status}
													</Badge>
												) : row.in_routing_window ? (
													<Badge variant='success'>In Window</Badge>
												) : (
													<Badge variant='muted'>Not Yet</Badge>
												)}
											</div>
											{row.next_game && <div className='mt-1 text-xs text-(--color-muted)'>{row.next_game}</div>}
											<div className='mt-1 flex items-center gap-3 text-xs text-(--color-muted)'>
												<span>{fmtDateTime(row.game_time) ?? 'No game'}</span>
												{row.streams_in_list > 0 && (
													<>
														<span className='text-(--color-muted)'>|</span>
														<span className='tabular-nums'>
															{row.matched_stream_name
																? `Matched from ${row.streams_in_list} potential stream${row.streams_in_list !== 1 ? 's' : ''}`
																: `${row.streams_in_list} potential stream${row.streams_in_list !== 1 ? 's' : ''}`}
														</span>
													</>
												)}
											</div>
											{row.matched_stream_name ? (
												<div className='mt-1.5 font-mono text-xs text-(--color-success)'>
													{row.matched_stream_name}
												</div>
											) : (
												row.status !== 'no_upcoming_game' && (
													<div className='mt-1.5 font-mono text-xs text-(--color-danger)'>
														{row.status === 'no_stream_match'
															? 'No matches found'
															: row.status === 'pattern_error'
																? 'Pattern error'
																: row.status === 'dispatcharr_error'
																	? 'Dispatcharr error'
																	: '—'}
													</div>
												)
											)}
										</div>
									</div>
								);
							})}
							{!streamMatches.data.items.length && (
								<p className='py-6 text-center text-sm text-(--color-muted)'>No team mappings to show.</p>
							)}
						</div>
					)}

					{!streamMatches.data && streamMatches.isLoading && (
						<div className='mt-4 space-y-2'>
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className='h-16' />
							))}
						</div>
					)}
				</Card>

				{/* Right: Game Schedule */}
				<Card>
					<CardTitle>Game Schedule</CardTitle>
					<p className='mt-1 text-xs text-(--color-muted)'>Upcoming games from the ESPN schedule (cached every 6 hours).</p>
					<div className='mt-4 space-y-2'>
						{d.upcoming_games?.length ? (
							d.upcoming_games.map((g, i) => (
								<CachedGameCard key={i} g={g as Record<string, unknown>} highlighted lookups={lookups} />
							))
						) : d.tracked_teams > 0 ? (
							<p className='py-6 text-center text-sm text-(--color-muted)'>
								No upcoming games in cache — run a match or wait for refresh.
							</p>
						) : (
							<p className='py-6 text-center text-sm text-(--color-muted)'>
								No schedule data yet — add profiles and teams first.
							</p>
						)}

						{(d.upcoming_games_extra_by_league ?? []).map((section) => {
							const id = section.league_profile_id;
							const n = section.games?.length ?? 0;
							if (n === 0) return null;
							const open = expandedLeagues.has(id);
							const sectionProfile = lookups.profileById.get(id);
							return (
								<div key={id} className='space-y-2'>
									<button
										type='button'
										onClick={() =>
											setExpandedLeagues((prev) => {
												const next = new Set(prev);
												if (next.has(id)) next.delete(id);
												else next.add(id);
												return next;
											})
										}
										className='flex w-full items-center gap-2 rounded-(--radius-md) border border-(--color-border) bg-(--color-surface-raised)/50 px-3 py-2 text-left text-xs font-medium text-(--color-muted) hover:text-(--color-foreground) transition-colors cursor-pointer'
									>
										{open ? (
											<ChevronDown className='h-3.5 w-3.5 shrink-0 text-(--color-accent)' />
										) : (
											<ChevronRight className='h-3.5 w-3.5 shrink-0' />
										)}
										{sectionProfile && <LeagueBadge league={sectionProfile.espn_league} size={16} />}
										<span>
											{open ? 'Hide' : 'Show'} {n} more in {section.league}
										</span>
									</button>
									{open &&
										section.games.map((g, j) => (
											<CachedGameCard
												key={`${id}-${j}`}
												g={g as Record<string, unknown>}
												highlighted={false}
												lookups={lookups}
											/>
										))}
								</div>
							);
						})}
					</div>
				</Card>
			</div>

			{/* Recent Switches — Timeline */}
			<Card>
				<CardTitle>Recent Switches</CardTitle>
				{d.recent_switches?.length ? (
					<div className='relative mt-4 ml-3 border-l-2 border-(--color-border) pl-6'>
						{d.recent_switches.map((s, i) => {
							const tcId = s.team_channel_id as number | undefined;
							const tc = tcId != null ? lookups.tcById.get(tcId) : undefined;
							const profile = tc ? lookups.profileById.get(tc.league_profile_id) : undefined;
							const fromName = String(s.from_stream_name ?? 'Empty Stream');
							const toName = String(s.to_stream_name ?? 'Empty Stream');
							return (
								<div key={i} className='relative pb-3.5 last:pb-0'>
									<span className='absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-(--color-border) bg-(--color-surface)'>
										<span className='h-1.5 w-1.5 rounded-full bg-(--color-accent)' />
									</span>
									<div className='flex min-w-0 items-start gap-2'>
										<TeamLogoFromChannel tc={tc} profile={profile} size={18} />
										<div className='min-w-0 flex-1'>
											<div className='flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
												<span className='text-[11px] tabular-nums text-(--color-muted)'>
													{String(s.switched_at)}
												</span>
												<span className='text-xs font-medium'>{String(s.team_name ?? '?')}</span>
											</div>
											<div className='mt-0.5 flex min-w-0 items-center gap-1 font-mono text-[11px] leading-tight'>
												<span className='min-w-0 truncate max-w-[300px] text-(--color-muted)' title={fromName}>
													{fromName}
												</span>
												<ArrowRight className='h-3 w-3 shrink-0 text-(--color-accent)' />
												<span className='min-w-0 truncate max-w-[300px] text-(--color-foreground)' title={toName}>
													{toName}
												</span>
											</div>
											<div className='mt-0.5 text-[11px] text-(--color-muted)' title={String(s.reason)}>
												{String(s.reason)}
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<p className='mt-4 py-6 text-center text-sm text-(--color-muted)'>No switch events yet.</p>
				)}
			</Card>
		</div>
	);
}
