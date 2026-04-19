import { Users, Briefcase, GraduationCap, MapPin } from 'lucide-react';
import { MetricCard } from '../MetricCard';
import { SectionCard } from '../SectionCard';
import { EntityCard } from '../EntityCard';

export function CandidateListView() {
  const metrics = [
    { label: 'Candidates Found', value: '156', icon: Users, trend: { value: '+24', direction: 'up' as const } },
    { label: 'Avg Experience', value: '8.5 yrs', icon: Briefcase },
    { label: 'Top Universities', value: '12', icon: GraduationCap },
    { label: 'Locations', value: '23', icon: MapPin },
  ];

  const candidates = [
    {
      name: 'Sarah Chen',
      subtitle: 'Senior Product Manager',
      tags: ['B2B SaaS', 'Growth', 'Analytics'],
      metrics: [
        { label: 'Experience', value: '9 years' },
        { label: 'Location', value: 'SF, CA' },
      ],
      description: 'Led product growth at Series B SaaS company, scaling from $2M to $15M ARR.',
    },
    {
      name: 'Michael Rodriguez',
      subtitle: 'Engineering Manager',
      tags: ['Platform', 'Infrastructure', 'Team Lead'],
      metrics: [
        { label: 'Experience', value: '11 years' },
        { label: 'Location', value: 'NYC, NY' },
      ],
      description: 'Built and scaled engineering teams at two high-growth startups.',
    },
    {
      name: 'Emily Johnson',
      subtitle: 'VP of Sales',
      tags: ['Enterprise', 'SaaS', 'Leadership'],
      metrics: [
        { label: 'Experience', value: '12 years' },
        { label: 'Location', value: 'Austin, TX' },
      ],
      description: 'Drove $50M+ in enterprise sales, built sales org from 5 to 45 people.',
    },
    {
      name: 'David Park',
      subtitle: 'Staff Engineer',
      tags: ['Backend', 'Distributed Systems', 'Golang'],
      metrics: [
        { label: 'Experience', value: '10 years' },
        { label: 'Location', value: 'Seattle, WA' },
      ],
      description: 'Core contributor to high-scale distributed systems at major tech companies.',
    },
    {
      name: 'Lisa Wang',
      subtitle: 'Head of Design',
      tags: ['Product Design', 'Design Systems', 'UX'],
      metrics: [
        { label: 'Experience', value: '8 years' },
        { label: 'Location', value: 'SF, CA' },
      ],
      description: 'Led design for consumer and enterprise products, built design systems.',
    },
    {
      name: 'James Anderson',
      subtitle: 'Marketing Director',
      tags: ['Growth Marketing', 'B2B', 'Content'],
      metrics: [
        { label: 'Experience', value: '7 years' },
        { label: 'Location', value: 'Boston, MA' },
      ],
      description: 'Scaled marketing from 0 to $10M pipeline at two B2B SaaS companies.',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-foreground">Senior Product & Engineering Candidates</h1>
        <p className="text-sm text-muted-foreground">
          Professionals with 7+ years experience in B2B SaaS, actively exploring new opportunities
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric, idx) => (
          <MetricCard key={idx} {...metric} />
        ))}
      </div>

      <SectionCard title="Top Candidates" action={
        <div className="flex gap-2">
          <button className="px-3 py-1 text-xs border border-border rounded hover:bg-accent transition-colors text-foreground">
            Filter
          </button>
          <button className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity">
            Export
          </button>
        </div>
      }>
        <div className="grid grid-cols-3 gap-4">
          {candidates.map((candidate, idx) => (
            <EntityCard key={idx} {...candidate} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}