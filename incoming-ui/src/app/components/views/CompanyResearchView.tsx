import { Building2, Users, TrendingUp, Globe } from 'lucide-react';
import { MetricCard } from '../MetricCard';
import { SectionCard } from '../SectionCard';
import { RecordTable } from '../RecordTable';
import { RankedList } from '../RankedList';

export function CompanyResearchView() {
  const metrics = [
    { label: 'Companies Found', value: '247', icon: Building2, trend: { value: '+12%', direction: 'up' as const } },
    { label: 'Total Employees', value: '12.4K', icon: Users },
    { label: 'Avg Growth Rate', value: '23%', icon: TrendingUp, trend: { value: '+5%', direction: 'up' as const } },
    { label: 'Markets', value: '18', icon: Globe },
  ];

  const topCompanies = [
    { rank: 1, name: 'Acme Corp', value: '$2.4M ARR', score: 95, metadata: 'Series B • 150 employees' },
    { rank: 2, name: 'TechFlow Inc', value: '$1.8M ARR', score: 92, metadata: 'Series A • 85 employees' },
    { rank: 3, name: 'DataWorks', value: '$1.2M ARR', score: 88, metadata: 'Seed • 45 employees' },
    { rank: 4, name: 'CloudScale', value: '$980K ARR', score: 85, metadata: 'Series A • 72 employees' },
    { rank: 5, name: 'APIFirst', value: '$850K ARR', score: 82, metadata: 'Seed • 38 employees' },
  ];

  const recentActivity = [
    { company: 'Acme Corp', activity: 'Raised Series B', date: '2 days ago', amount: '$15M' },
    { company: 'TechFlow Inc', activity: 'New Product Launch', date: '1 week ago', amount: '—' },
    { company: 'DataWorks', activity: 'Key Hire (CTO)', date: '2 weeks ago', amount: '—' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-foreground">B2B SaaS Companies</h1>
        <p className="text-sm text-muted-foreground">
          Series A-B companies in enterprise software, 50-200 employees
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric, idx) => (
          <MetricCard key={idx} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <SectionCard title="Top Prospects" action={
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all
          </button>
        }>
          <RankedList items={topCompanies} />
        </SectionCard>

        <SectionCard title="Recent Activity">
          <RecordTable
            columns={[
              { key: 'company', label: 'Company', width: '35%' },
              { key: 'activity', label: 'Activity', width: '35%' },
              { key: 'date', label: 'Date', width: '20%' },
              { key: 'amount', label: 'Amount', width: '10%' },
            ]}
            data={recentActivity}
          />
        </SectionCard>
      </div>

      <SectionCard title="All Companies" action={
        <div className="flex gap-2">
          <button className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity">
            Export CSV
          </button>
        </div>
      }>
        <RecordTable
          columns={[
            { key: 'name', label: 'Company Name', width: '25%' },
            { key: 'stage', label: 'Stage', width: '15%' },
            { key: 'employees', label: 'Employees', width: '15%' },
            { key: 'industry', label: 'Industry', width: '20%' },
            { key: 'location', label: 'Location', width: '15%' },
            { key: 'score', label: 'Score', width: '10%' },
          ]}
          data={[
            { name: 'Acme Corp', stage: 'Series B', employees: '150', industry: 'Developer Tools', location: 'SF, CA', score: '95' },
            { name: 'TechFlow Inc', stage: 'Series A', employees: '85', industry: 'Data Analytics', location: 'NYC, NY', score: '92' },
            { name: 'DataWorks', stage: 'Seed', employees: '45', industry: 'Infrastructure', location: 'Austin, TX', score: '88' },
            { name: 'CloudScale', stage: 'Series A', employees: '72', industry: 'Cloud Platform', location: 'Seattle, WA', score: '85' },
            { name: 'APIFirst', stage: 'Seed', employees: '38', industry: 'API Tools', location: 'Boston, MA', score: '82' },
          ]}
        />
      </SectionCard>
    </div>
  );
}