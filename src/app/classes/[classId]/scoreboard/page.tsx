import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ScoreRow = {
	student_id: string;
	class_id: string;
	term: string;
	term_total: number;
};

export default async function ClassScoreboardPage({
	params,
}: {
	params: Promise<{ classId: string }>;
}) {
	const { classId } = await params;
	const profile = await requireProfile();
	const supabase = await createServerSupabaseClient();

	const [{ data: classData }, { data: myMembership }, { data: scoreRows }] = await Promise.all([
		supabase
			.from("classes")
			.select("id, name, teacher_id")
			.eq("id", classId)
			.single(),
		supabase
			.from("class_students")
			.select("id, member_role")
			.eq("class_id", classId)
			.eq("student_id", profile.id)
			.maybeSingle(),
		supabase
			.from("student_scores")
			.select("student_id, class_id, term, term_total")
			.eq("class_id", classId)
			.order("term_total", { ascending: false }),
	]);

	if (!classData) {
		notFound();
	}

	const isTeacherOwner = classData.teacher_id === profile.id;
	const isAdmin = profile.role === "admin";
	const isTeacherMemberManager = myMembership?.member_role === "teacher";
	const canView = Boolean(myMembership) || isTeacherOwner || isAdmin || isTeacherMemberManager;

	if (!canView) {
		notFound();
	}

	const scoreList = (scoreRows ?? []) as ScoreRow[];
	const studentIds = Array.from(new Set(scoreList.map((row) => row.student_id)));
	const { data: profiles } = studentIds.length > 0
		? await supabase
				.from("profiles")
				.select("id, full_name")
				.in("id", studentIds)
		: { data: [] as Array<{ id: string; full_name: string | null }> };

	const nameByStudentId = new Map((profiles ?? []).map((item) => [item.id, item.full_name || "Unnamed Student"] as const));

	return (
		<AppShell
			name={profile.full_name || "User"}
			role={profile.role}
			title="Scoreboard"
			subtitle={`Class: ${classData.name}`}
		>
			<div className="mx-auto w-full max-w-5xl space-y-4">
				<section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
					<h2 className="text-lg font-semibold text-[var(--foreground)]">Class Scoreboard</h2>
					<p className="mt-1 text-sm text-[var(--muted)]">Term totals are listed from highest to lowest.</p>
				</section>

				<section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
					{scoreList.length > 0 ? (
						<div className="overflow-hidden rounded-2xl border border-[var(--border)]">
							<table className="w-full border-collapse text-sm">
								<thead className="bg-[var(--surface-elevated)] text-left text-[var(--muted)]">
									<tr>
										<th className="px-4 py-3 font-semibold">Student</th>
										<th className="px-4 py-3 font-semibold">Term</th>
										<th className="px-4 py-3 font-semibold text-right">Term Total</th>
									</tr>
								</thead>
								<tbody>
									{scoreList.map((row) => (
										<tr key={`${row.student_id}-${row.term}`} className="border-t border-[var(--border)]">
											<td className="px-4 py-3 font-medium text-[var(--foreground)]">
												{nameByStudentId.get(row.student_id) || "Unnamed Student"}
											</td>
											<td className="px-4 py-3 text-[var(--muted)]">{row.term}</td>
											<td className="px-4 py-3 text-right font-semibold text-[var(--foreground)]">{row.term_total}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<p className="text-sm text-[var(--muted)]">No scoreboard data yet.</p>
					)}
				</section>
			</div>
		</AppShell>
	);
}
