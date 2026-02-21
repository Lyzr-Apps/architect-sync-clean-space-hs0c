'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { uploadAndTrainDocument, getDocuments, deleteDocuments } from '@/lib/ragKnowledgeBase'
import type { RAGDocument } from '@/lib/ragKnowledgeBase'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import {
  HiHome,
  HiClock,
  HiCog6Tooth,
  HiMagnifyingGlass,
  HiDocumentText,
  HiUserGroup,
  HiCalendar,
  HiExclamationTriangle,
  HiCheckCircle,
  HiArrowLeft,
  HiClipboardDocument,
  HiChevronDown,
  HiChevronUp,
  HiXMark,
  HiArrowPath,
  HiFlag,
  HiLightBulb,
  HiBolt,
  HiShieldCheck,
  HiCloudArrowUp,
  HiTrash,
  HiCpuChip,
  HiBars3,
} from 'react-icons/hi2'

// ─── Agent IDs ───
const MANAGER_AGENT_ID = '699959a07929f75fa2684eb4'
const CALENDAR_AGENT_ID = '699959877929f75fa2684ea8'
const TRANSCRIPT_AGENT_ID = '699959887929f75fa2684eac'
const ANALYST_AGENT_ID = '69995988db37e68c87a52d60'
const SEARCH_AGENT_ID = '699959b17929f75fa2684eb9'
const RAG_ID = '69995926e12ce168202fcc11'

// ─── Types ───
interface MeetingMetadata {
  title: string
  date_time: string
  duration_minutes: number
  organizer: string
  attendee_count: number
  timezone: string
}

interface TechnicalDecision {
  decision: string
  context: string
  rationale: string
}

interface ActionItem {
  item: string
  owner: string
  deadline: string
  priority: string
  status: string
}

interface RiskBlocker {
  description: string
  severity: string
  impact: string
  mitigation: string
}

interface ClientRequirement {
  requirement: string
  source: string
  priority: string
}

interface ArchitectureReference {
  reference: string
  context: string
}

interface OpenItem {
  item: string
  type: string
  assigned_to: string
}

interface ProcessedMeeting {
  meeting_metadata: MeetingMetadata
  summary: string
  technical_decisions: TechnicalDecision[]
  action_items: ActionItem[]
  risks_and_blockers: RiskBlocker[]
  client_requirements: ClientRequirement[]
  architecture_references: ArchitectureReference[]
  open_items: OpenItem[]
}

interface SearchResult {
  meeting_title: string
  meeting_date: string
  relevance_score: string
  matching_section: string
  excerpt: string
  key_participants: string[]
}

interface SearchResponse {
  query: string
  total_results: number
  results: SearchResult[]
  suggested_refinements: string[]
}

interface LocalMeeting {
  id: string
  title: string
  date: string
  time: string
  attendees: number
  organizer: string
  status: 'pending' | 'processed'
  description: string
  processedData?: ProcessedMeeting
}

type ScreenType = 'dashboard' | 'notes' | 'history' | 'settings'

// ─── Agent info ───
const AGENTS = [
  { id: MANAGER_AGENT_ID, name: 'Meeting Processing Coordinator', purpose: 'Orchestrates end-to-end meeting processing' },
  { id: CALENDAR_AGENT_ID, name: 'Calendar Context Agent', purpose: 'Extracts calendar metadata and attendees' },
  { id: TRANSCRIPT_AGENT_ID, name: 'Transcript Retrieval Agent', purpose: 'Retrieves and structures meeting transcripts' },
  { id: ANALYST_AGENT_ID, name: 'Meeting Analyst Agent', purpose: 'Analyzes content for decisions, actions, risks' },
  { id: SEARCH_AGENT_ID, name: 'Meeting Search Agent', purpose: 'Searches past meeting notes by query' },
]

// ─── Sample data ───
const SAMPLE_MEETINGS: LocalMeeting[] = [
  {
    id: '1',
    title: 'Q1 Product Roadmap Review',
    date: '2025-01-15',
    time: '10:00 AM',
    attendees: 8,
    organizer: 'Sarah Chen',
    status: 'pending',
    description: 'Review Q1 product roadmap priorities, discuss resource allocation, and finalize sprint commitments for the upcoming quarter.',
  },
  {
    id: '2',
    title: 'Backend Architecture Discussion',
    date: '2025-01-14',
    time: '2:00 PM',
    attendees: 5,
    organizer: 'Marcus Johnson',
    status: 'pending',
    description: 'Discuss microservices migration strategy, API gateway selection, and database sharding approach for the platform modernization project.',
  },
  {
    id: '3',
    title: 'Client Onboarding Sync',
    date: '2025-01-13',
    time: '11:30 AM',
    attendees: 6,
    organizer: 'Emily Rodriguez',
    status: 'pending',
    description: 'Sync on new client onboarding requirements, integration timeline, compliance checks, and data migration steps.',
  },
  {
    id: '4',
    title: 'Sprint Retrospective - Team Alpha',
    date: '2025-01-12',
    time: '4:00 PM',
    attendees: 7,
    organizer: 'David Park',
    status: 'pending',
    description: 'Sprint retrospective for Team Alpha covering velocity analysis, blocker review, process improvements, and action items from the previous sprint.',
  },
]

const SAMPLE_PROCESSED: ProcessedMeeting = {
  meeting_metadata: {
    title: 'Q1 Product Roadmap Review',
    date_time: '2025-01-15T10:00:00',
    duration_minutes: 60,
    organizer: 'Sarah Chen',
    attendee_count: 8,
    timezone: 'America/New_York',
  },
  summary: 'The team reviewed the Q1 product roadmap and finalized sprint priorities. Key decisions included adopting a new authentication framework and migrating the payment module to microservices. Three critical action items were assigned with deadlines within the next two weeks. The team identified two major risks related to third-party API dependencies and resource constraints.',
  technical_decisions: [
    { decision: 'Adopt OAuth 2.1 with PKCE for authentication', context: 'Current auth system lacks modern security features', rationale: 'Improved security posture and compliance with SOC2 requirements' },
    { decision: 'Migrate payment module to standalone microservice', context: 'Monolith causing deployment bottlenecks', rationale: 'Independent scaling and faster deployment cycles for payment features' },
  ],
  action_items: [
    { item: 'Draft OAuth 2.1 migration plan', owner: 'Marcus Johnson', deadline: '2025-01-22', priority: 'high', status: 'in-progress' },
    { item: 'Set up payment microservice repository', owner: 'David Park', deadline: '2025-01-20', priority: 'high', status: 'pending' },
    { item: 'Update API documentation for v2 endpoints', owner: 'Emily Rodriguez', deadline: '2025-01-25', priority: 'medium', status: 'pending' },
    { item: 'Schedule load testing for auth changes', owner: 'Sarah Chen', deadline: '2025-01-28', priority: 'low', status: 'pending' },
  ],
  risks_and_blockers: [
    { description: 'Third-party payment gateway API deprecation in March', severity: 'critical', impact: 'Payment processing could fail if migration not completed', mitigation: 'Prioritize payment microservice migration, implement fallback gateway' },
    { description: 'Limited DevOps bandwidth for infrastructure changes', severity: 'high', impact: 'May delay microservice deployment timeline', mitigation: 'Request temporary DevOps contractor, automate CI/CD pipeline' },
  ],
  client_requirements: [
    { requirement: 'SSO integration with Azure AD', source: 'Enterprise client feedback', priority: 'high' },
    { requirement: 'Multi-currency support in payment module', source: 'APAC expansion initiative', priority: 'medium' },
  ],
  architecture_references: [
    { reference: 'OAuth 2.1 RFC 9126', context: 'Standard for Pushed Authorization Requests' },
    { reference: 'AWS ECS Fargate deployment pattern', context: 'Container orchestration for payment microservice' },
  ],
  open_items: [
    { item: 'Evaluate Stripe vs Adyen for new payment gateway', type: 'research', assigned_to: 'David Park' },
    { item: 'Define SLA requirements for payment microservice', type: 'decision', assigned_to: 'Sarah Chen' },
    { item: 'Review security audit findings from Q4', type: 'follow-up', assigned_to: 'Marcus Johnson' },
  ],
}

// ─── Utility: parse agent response robustly ───
function parseAgentResponse<T>(result: any): T | null {
  if (!result) return null

  let data = result?.response?.result
  if (!data) {
    data = result?.response?.message
  }
  if (!data) return null

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    // Check if it has a nested text field containing JSON
    if (typeof data?.text === 'string') {
      try {
        const innerParsed = JSON.parse(data.text)
        if (typeof innerParsed === 'object' && innerParsed !== null) {
          return innerParsed as T
        }
      } catch {
        // not json in text
      }
    }
    return data as T
  }

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as T
      }
      if (typeof parsed === 'string') {
        try {
          const doubleParsed = JSON.parse(parsed)
          if (typeof doubleParsed === 'object' && doubleParsed !== null) {
            return doubleParsed as T
          }
        } catch {
          // not double-encoded
        }
      }
    } catch {
      // not JSON
    }
  }

  return null
}

// ─── Markdown renderer ───
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm leading-relaxed">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// ─── Priority / severity color helpers ───
function getPriorityClasses(priority: string): string {
  const p = (priority ?? '').toLowerCase()
  if (p === 'high' || p === 'critical') return 'bg-red-900/40 text-red-300 border-red-700/40'
  if (p === 'medium') return 'bg-orange-900/40 text-orange-300 border-orange-700/40'
  if (p === 'low') return 'bg-green-900/40 text-green-300 border-green-700/40'
  return 'bg-secondary text-secondary-foreground border-border'
}

function getSeverityClasses(severity: string): string {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return 'bg-red-900/40 text-red-300 border-red-700/40'
  if (s === 'high') return 'bg-orange-900/40 text-orange-300 border-orange-700/40'
  if (s === 'medium') return 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40'
  if (s === 'low') return 'bg-green-900/40 text-green-300 border-green-700/40'
  return 'bg-secondary text-secondary-foreground border-border'
}

function getSeverityDot(severity: string): string {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return 'bg-red-400'
  if (s === 'high') return 'bg-orange-400'
  if (s === 'medium') return 'bg-yellow-400'
  if (s === 'low') return 'bg-green-400'
  return 'bg-muted-foreground'
}

// ─── ErrorBoundary ───
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Collapsible Section Card ───
function SectionCard({
  title,
  icon,
  children,
  defaultOpen = true,
  count,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  count?: number
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-secondary/50 transition-colors p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-accent">{icon}</span>
                <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                {typeof count === 'number' && (
                  <Badge variant="secondary" className="text-xs ml-1">{count}</Badge>
                )}
              </div>
              {isOpen ? <HiChevronUp className="h-4 w-4 text-muted-foreground" /> : <HiChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-4 pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ─── Sidebar nav ───
function SidebarNav({
  activeScreen,
  onNavigate,
  sidebarOpen,
  onToggleSidebar,
}: {
  activeScreen: ScreenType
  onNavigate: (s: ScreenType) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  const navItems: { id: ScreenType; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <HiHome className="h-5 w-5" /> },
    { id: 'history', label: 'Meeting History', icon: <HiClock className="h-5 w-5" /> },
    { id: 'settings', label: 'Settings', icon: <HiCog6Tooth className="h-5 w-5" /> },
  ]

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggleSidebar} />
      )}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border flex flex-col transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-accent/20 flex items-center justify-center">
              <HiCpuChip className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">Meeting Intelligence</h1>
              <p className="text-xs text-muted-foreground">Hub</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id)
                onToggleSidebar()
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                activeScreen === item.id
                  ? 'bg-accent/20 text-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2 font-medium">Agents</div>
          <div className="space-y-1.5">
            {AGENTS.map((agent) => (
              <div key={agent.id} className="flex items-center gap-2 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 flex-shrink-0" />
                <span className="text-muted-foreground truncate">{agent.name}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  )
}

// ─── Dashboard Screen ───
function DashboardScreen({
  meetings,
  selectedMeeting,
  onSelectMeeting,
  onProcessMeeting,
  isProcessing,
  activeAgentId,
  meetingInput,
  onMeetingInputChange,
  onProcessCustom,
}: {
  meetings: LocalMeeting[]
  selectedMeeting: LocalMeeting | null
  onSelectMeeting: (m: LocalMeeting) => void
  onProcessMeeting: (m: LocalMeeting) => void
  isProcessing: boolean
  activeAgentId: string | null
  meetingInput: string
  onMeetingInputChange: (v: string) => void
  onProcessCustom: () => void
}) {
  const totalMeetings = meetings.length
  const processedCount = meetings.filter((m) => m.status === 'processed').length
  const pendingActions = meetings.reduce((acc, m) => {
    if (m.processedData) {
      return acc + (Array.isArray(m.processedData.action_items) ? m.processedData.action_items.filter((a) => (a?.status ?? '') !== 'completed').length : 0)
    }
    return acc
  }, 0)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/15 flex items-center justify-center">
                <HiCalendar className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{totalMeetings}</p>
                <p className="text-xs text-muted-foreground">Total Meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-900/30 flex items-center justify-center">
                <HiCheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{processedCount}</p>
                <p className="text-xs text-muted-foreground">Processed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-900/30 flex items-center justify-center">
                <HiFlag className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{pendingActions}</p>
                <p className="text-xs text-muted-foreground">Pending Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Meeting list */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Meetings</h2>
          <ScrollArea className="h-[420px]">
            <div className="space-y-2 pr-2">
              {meetings.length === 0 && (
                <div className="text-center py-10">
                  <HiCalendar className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No meetings yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Enable Sample Data or paste meeting details below.</p>
                </div>
              )}
              {meetings.map((m) => (
                <Card
                  key={m.id}
                  className={cn(
                    'cursor-pointer transition-all duration-150 border',
                    selectedMeeting?.id === m.id ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/40'
                  )}
                  onClick={() => onSelectMeeting(m)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <HiCalendar className="h-3 w-3 flex-shrink-0" />
                          <span>{m.date}</span>
                          <span>{m.time}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <HiUserGroup className="h-3 w-3 flex-shrink-0" />
                          <span>{m.attendees} attendees</span>
                        </div>
                      </div>
                      <Badge
                        variant={m.status === 'processed' ? 'default' : 'secondary'}
                        className={cn(
                          'text-xs flex-shrink-0',
                          m.status === 'processed' ? 'bg-green-900/40 text-green-300 border-green-700/40' : ''
                        )}
                      >
                        {m.status === 'processed' ? 'Processed' : 'Pending'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Detail panel / Custom input */}
        <div className="lg:col-span-3 space-y-3">
          {selectedMeeting ? (
            <Card className="border-border">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">{selectedMeeting.title}</CardTitle>
                <CardDescription className="text-xs">
                  Organized by {selectedMeeting.organizer}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">Date & Time</span>
                    <span className="font-medium">{selectedMeeting.date} {selectedMeeting.time}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Attendees</span>
                    <span className="font-medium">{selectedMeeting.attendees}</span>
                  </div>
                </div>
                <Separator />
                <div>
                  <span className="text-muted-foreground text-xs block mb-1">Description</span>
                  <p className="text-sm leading-relaxed">{selectedMeeting.description}</p>
                </div>
                <Button
                  onClick={() => onProcessMeeting(selectedMeeting)}
                  disabled={isProcessing || selectedMeeting.status === 'processed'}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <HiArrowPath className="h-4 w-4 mr-2 animate-spin" />
                      Processing meeting...
                    </>
                  ) : selectedMeeting.status === 'processed' ? (
                    <>
                      <HiCheckCircle className="h-4 w-4 mr-2" />
                      Already Processed
                    </>
                  ) : (
                    <>
                      <HiBolt className="h-4 w-4 mr-2" />
                      Process Meeting
                    </>
                  )}
                </Button>
                {isProcessing && activeAgentId && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-md p-2">
                    <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                    <span>Active: {AGENTS.find((a) => a.id === activeAgentId)?.name ?? 'Agent'}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardContent className="p-6 text-center">
                <HiDocumentText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">Select a meeting from the list</p>
                <p className="text-xs text-muted-foreground">or paste custom meeting details below</p>
              </CardContent>
            </Card>
          )}

          {/* Custom meeting input */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Paste Meeting Details</CardTitle>
              <CardDescription className="text-xs">
                Paste a transcript, agenda, or meeting notes to process
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <Textarea
                placeholder="Paste meeting transcript, notes, or agenda here..."
                value={meetingInput}
                onChange={(e) => onMeetingInputChange(e.target.value)}
                className="min-h-[120px] bg-input border-border text-sm"
              />
              <Button
                onClick={onProcessCustom}
                disabled={isProcessing || !meetingInput.trim()}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <HiArrowPath className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <HiBolt className="h-4 w-4 mr-2" />
                    Process Custom Meeting
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Meeting Notes Screen ───
function NotesScreen({
  processedData,
  onBack,
}: {
  processedData: ProcessedMeeting | null
  onBack: () => void
}) {
  const [copied, setCopied] = useState(false)

  if (!processedData) {
    return (
      <div className="text-center py-16">
        <HiDocumentText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No processed meeting data to display.</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <HiArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    )
  }

  const handleCopy = () => {
    const metadata = processedData?.meeting_metadata
    const lines: string[] = []
    lines.push(`MEETING NOTES: ${metadata?.title ?? 'Untitled'}`)
    lines.push(`Date: ${metadata?.date_time ?? ''} | Duration: ${metadata?.duration_minutes ?? 0} min | Organizer: ${metadata?.organizer ?? ''}`)
    lines.push('')
    lines.push('SUMMARY')
    lines.push(processedData?.summary ?? '')
    lines.push('')

    const tdArr = Array.isArray(processedData?.technical_decisions) ? processedData.technical_decisions : []
    if (tdArr.length > 0) {
      lines.push('TECHNICAL DECISIONS')
      tdArr.forEach((d, i) => {
        lines.push(`${i + 1}. ${d?.decision ?? ''} - Context: ${d?.context ?? ''} - Rationale: ${d?.rationale ?? ''}`)
      })
      lines.push('')
    }

    const aiArr = Array.isArray(processedData?.action_items) ? processedData.action_items : []
    if (aiArr.length > 0) {
      lines.push('ACTION ITEMS')
      aiArr.forEach((a) => {
        lines.push(`- [${(a?.priority ?? '').toUpperCase()}] ${a?.item ?? ''} -> ${a?.owner ?? ''} (${a?.deadline ?? ''}) [${a?.status ?? ''}]`)
      })
      lines.push('')
    }

    const rbArr = Array.isArray(processedData?.risks_and_blockers) ? processedData.risks_and_blockers : []
    if (rbArr.length > 0) {
      lines.push('RISKS & BLOCKERS')
      rbArr.forEach((r) => {
        lines.push(`- [${(r?.severity ?? '').toUpperCase()}] ${r?.description ?? ''} | Impact: ${r?.impact ?? ''} | Mitigation: ${r?.mitigation ?? ''}`)
      })
      lines.push('')
    }

    const crArr = Array.isArray(processedData?.client_requirements) ? processedData.client_requirements : []
    if (crArr.length > 0) {
      lines.push('CLIENT REQUIREMENTS')
      crArr.forEach((c) => {
        lines.push(`- [${(c?.priority ?? '').toUpperCase()}] ${c?.requirement ?? ''} (Source: ${c?.source ?? ''})`)
      })
      lines.push('')
    }

    const arArr = Array.isArray(processedData?.architecture_references) ? processedData.architecture_references : []
    if (arArr.length > 0) {
      lines.push('ARCHITECTURE REFERENCES')
      arArr.forEach((a) => {
        lines.push(`- ${a?.reference ?? ''}: ${a?.context ?? ''}`)
      })
      lines.push('')
    }

    const oiArr = Array.isArray(processedData?.open_items) ? processedData.open_items : []
    if (oiArr.length > 0) {
      lines.push('OPEN ITEMS')
      oiArr.forEach((o) => {
        lines.push(`- [${(o?.type ?? '').toUpperCase()}] ${o?.item ?? ''} -> ${o?.assigned_to ?? ''}`)
      })
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // clipboard access denied silently
    })
  }

  const metadata = processedData?.meeting_metadata
  const technicalDecisions = Array.isArray(processedData?.technical_decisions) ? processedData.technical_decisions : []
  const actionItems = Array.isArray(processedData?.action_items) ? processedData.action_items : []
  const risksBlockers = Array.isArray(processedData?.risks_and_blockers) ? processedData.risks_and_blockers : []
  const clientRequirements = Array.isArray(processedData?.client_requirements) ? processedData.client_requirements : []
  const architectureRefs = Array.isArray(processedData?.architecture_references) ? processedData.architecture_references : []
  const openItems = Array.isArray(processedData?.open_items) ? processedData.open_items : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <HiArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h2 className="text-base font-semibold">{metadata?.title ?? 'Meeting Notes'}</h2>
            <p className="text-xs text-muted-foreground">
              {metadata?.date_time ?? ''} | {metadata?.duration_minutes ?? 0} min | {metadata?.organizer ?? ''}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <HiClipboardDocument className="h-4 w-4 mr-1" />
          {copied ? 'Copied' : 'Copy Notes'}
        </Button>
      </div>

      {/* Metadata bar */}
      <Card className="border-border">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <HiCalendar className="h-3.5 w-3.5 text-accent" />
              <span className="text-muted-foreground">Date:</span>
              <span className="font-medium">{metadata?.date_time ?? 'N/A'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HiClock className="h-3.5 w-3.5 text-accent" />
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium">{metadata?.duration_minutes ?? 0} min</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HiUserGroup className="h-3.5 w-3.5 text-accent" />
              <span className="text-muted-foreground">Attendees:</span>
              <span className="font-medium">{metadata?.attendee_count ?? 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HiCog6Tooth className="h-3.5 w-3.5 text-accent" />
              <span className="text-muted-foreground">Timezone:</span>
              <span className="font-medium">{metadata?.timezone ?? 'N/A'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <SectionCard title="Summary" icon={<HiDocumentText className="h-4 w-4" />} defaultOpen={true}>
        {renderMarkdown(processedData?.summary ?? '')}
      </SectionCard>

      {/* Technical Decisions */}
      <SectionCard title="Technical Decisions" icon={<HiCpuChip className="h-4 w-4" />} count={technicalDecisions.length} defaultOpen={true}>
        {technicalDecisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No technical decisions recorded.</p>
        ) : (
          <div className="space-y-3">
            {technicalDecisions.map((d, i) => (
              <div key={i} className="bg-secondary/40 rounded-md p-3 border border-border">
                <p className="text-sm font-medium mb-1">
                  <span className="text-accent mr-1.5">{i + 1}.</span>
                  {d?.decision ?? ''}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <div>
                    <span className="text-xs text-muted-foreground block">Context</span>
                    <p className="text-xs leading-relaxed">{d?.context ?? ''}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Rationale</span>
                    <p className="text-xs leading-relaxed">{d?.rationale ?? ''}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Action Items */}
      <SectionCard title="Action Items" icon={<HiCheckCircle className="h-4 w-4" />} count={actionItems.length} defaultOpen={true}>
        {actionItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No action items recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3 font-medium">Item</th>
                  <th className="text-left py-2 pr-3 font-medium">Owner</th>
                  <th className="text-left py-2 pr-3 font-medium">Deadline</th>
                  <th className="text-left py-2 pr-3 font-medium">Priority</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {actionItems.map((a, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3 text-xs">{a?.item ?? ''}</td>
                    <td className="py-2 pr-3 text-xs font-medium">{a?.owner ?? ''}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{a?.deadline ?? ''}</td>
                    <td className="py-2 pr-3">
                      <Badge className={cn('text-xs border', getPriorityClasses(a?.priority ?? ''))}>
                        {a?.priority ?? 'N/A'}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Badge variant="outline" className="text-xs">{a?.status ?? 'N/A'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Risks & Blockers */}
      <SectionCard title="Risks & Blockers" icon={<HiExclamationTriangle className="h-4 w-4" />} count={risksBlockers.length} defaultOpen={true}>
        {risksBlockers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No risks or blockers identified.</p>
        ) : (
          <div className="space-y-3">
            {risksBlockers.map((r, i) => (
              <div key={i} className="bg-secondary/40 rounded-md p-3 border border-border">
                <div className="flex items-start gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full mt-1 flex-shrink-0', getSeverityDot(r?.severity ?? ''))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-medium">{r?.description ?? ''}</p>
                      <Badge className={cn('text-xs border flex-shrink-0', getSeverityClasses(r?.severity ?? ''))}>
                        {r?.severity ?? 'N/A'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <div>
                        <span className="text-xs text-muted-foreground block">Impact</span>
                        <p className="text-xs leading-relaxed">{r?.impact ?? ''}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Mitigation</span>
                        <p className="text-xs leading-relaxed">{r?.mitigation ?? ''}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Client Requirements */}
      <SectionCard title="Client Requirements" icon={<HiFlag className="h-4 w-4" />} count={clientRequirements.length} defaultOpen={true}>
        {clientRequirements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No client requirements extracted.</p>
        ) : (
          <div className="space-y-2">
            {clientRequirements.map((c, i) => (
              <div key={i} className="flex items-start justify-between gap-2 bg-secondary/40 rounded-md p-3 border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c?.requirement ?? ''}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Source: {c?.source ?? 'N/A'}</p>
                </div>
                <Badge className={cn('text-xs border flex-shrink-0', getPriorityClasses(c?.priority ?? ''))}>
                  {c?.priority ?? 'N/A'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Architecture References */}
      <SectionCard title="Architecture References" icon={<HiShieldCheck className="h-4 w-4" />} count={architectureRefs.length} defaultOpen={true}>
        {architectureRefs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No architecture references noted.</p>
        ) : (
          <div className="space-y-2">
            {architectureRefs.map((a, i) => (
              <div key={i} className="bg-secondary/40 rounded-md p-3 border border-border">
                <p className="text-sm font-medium">{a?.reference ?? ''}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a?.context ?? ''}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Open Items */}
      <SectionCard title="Open Items & Next Steps" icon={<HiLightBulb className="h-4 w-4" />} count={openItems.length} defaultOpen={true}>
        {openItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open items.</p>
        ) : (
          <div className="space-y-2">
            {openItems.map((o, i) => (
              <div key={i} className="flex items-start justify-between gap-2 bg-secondary/40 rounded-md p-3 border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{o?.item ?? ''}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Assigned to: {o?.assigned_to ?? 'N/A'}</p>
                </div>
                <Badge variant="outline" className="text-xs flex-shrink-0">{o?.type ?? 'N/A'}</Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── History Screen ───
function HistoryScreen({
  onViewExcerpt,
}: {
  onViewExcerpt: (excerpt: string, title: string) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<RAGDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true)
    try {
      const res = await getDocuments(RAG_ID)
      if (res.success && Array.isArray(res.documents)) {
        setDocuments(res.documents)
      }
    } catch {
      // silent fail for doc listing
    }
    setDocsLoading(false)
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setSearchError(null)
    setSearchResults(null)
    try {
      const result = await callAIAgent(searchQuery.trim(), SEARCH_AGENT_ID)
      if (result.success) {
        const parsed = parseAgentResponse<SearchResponse>(result)
        if (parsed) {
          setSearchResults(parsed)
        } else {
          const text = result?.response?.result?.text ?? result?.response?.message ?? ''
          if (typeof text === 'string' && text.length > 0) {
            try {
              const jsonParsed = JSON.parse(text) as SearchResponse
              setSearchResults(jsonParsed)
            } catch {
              setSearchError('Could not parse search results. Raw response received.')
            }
          } else {
            setSearchError('No results returned from search agent.')
          }
        }
      } else {
        setSearchError(result?.error ?? 'Search failed. Please try again.')
      }
    } catch {
      setSearchError('Network error during search.')
    }
    setIsSearching(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    setUploadStatus('Uploading...')
    setUploadError(null)
    try {
      const result = await uploadAndTrainDocument(RAG_ID, file)
      if (result.success) {
        setUploadStatus('Upload successful. Document is being processed.')
        await loadDocuments()
      } else {
        setUploadError(result.error ?? 'Upload failed.')
        setUploadStatus(null)
      }
    } catch {
      setUploadError('Upload failed due to network error.')
      setUploadStatus(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setTimeout(() => setUploadStatus(null), 3000)
  }

  const handleDeleteDoc = async (fileName: string) => {
    try {
      const result = await deleteDocuments(RAG_ID, [fileName])
      if (result.success) {
        setDocuments((prev) => prev.filter((d) => d.fileName !== fileName))
      }
    } catch {
      // silent
    }
  }

  const results = Array.isArray(searchResults?.results) ? searchResults.results : []
  const refinements = Array.isArray(searchResults?.suggested_refinements) ? searchResults.suggested_refinements : []

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Search Meeting Notes</CardTitle>
          <CardDescription className="text-xs">Search across all processed meeting notes by topic, participant, or keyword</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. authentication decisions, action items for Marcus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-input border-border text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
            />
            <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? (
                <HiArrowPath className="h-4 w-4 animate-spin" />
              ) : (
                <HiMagnifyingGlass className="h-4 w-4" />
              )}
              <span className="ml-1.5 hidden sm:inline">Search</span>
            </Button>
          </div>

          {searchError && (
            <div className="bg-destructive/20 border border-destructive/40 rounded-md p-3 flex items-start gap-2">
              <HiExclamationTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-destructive">{searchError}</p>
                <Button variant="outline" size="sm" onClick={handleSearch} className="mt-2">
                  <HiArrowPath className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {isSearching && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <HiArrowPath className="h-5 w-5 animate-spin text-accent" />
              <span className="text-sm text-muted-foreground">Searching meeting notes...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults && !isSearching && (
        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Results</CardTitle>
              <Badge variant="secondary" className="text-xs">{searchResults?.total_results ?? results.length} found</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No matching meetings found.</p>
            ) : (
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="bg-secondary/40 rounded-md p-3 border border-border cursor-pointer hover:border-accent/40 transition-colors"
                    onClick={() => onViewExcerpt(r?.excerpt ?? '', r?.meeting_title ?? 'Meeting')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{r?.meeting_title ?? ''}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <HiCalendar className="h-3 w-3" />
                            {r?.meeting_date ?? ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <HiDocumentText className="h-3 w-3" />
                            {r?.matching_section ?? ''}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs flex-shrink-0">Score: {r?.relevance_score ?? 'N/A'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r?.excerpt ?? ''}</p>
                    {Array.isArray(r?.key_participants) && r.key_participants.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.key_participants.map((p, pi) => (
                          <Badge key={pi} variant="secondary" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {refinements.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">Suggested refinements:</p>
                <div className="flex flex-wrap gap-1.5">
                  {refinements.map((ref, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSearchQuery(ref)
                      }}
                      className="px-2.5 py-1 text-xs bg-secondary rounded-full text-secondary-foreground hover:bg-accent/20 hover:text-accent transition-colors"
                    >
                      {ref}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Knowledge Base Upload */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Knowledge Base</CardTitle>
          <CardDescription className="text-xs">Upload meeting documents (PDF, DOCX, TXT) to the knowledge base for searching</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={docsLoading}
            >
              <HiCloudArrowUp className="h-4 w-4 mr-1.5" />
              Upload Document
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDocuments}
              disabled={docsLoading}
            >
              <HiArrowPath className={cn('h-4 w-4', docsLoading ? 'animate-spin' : '')} />
            </Button>
          </div>

          {uploadStatus && (
            <div className="bg-green-900/30 border border-green-700/40 rounded-md p-2 text-xs text-green-300 flex items-center gap-2">
              <HiCheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {uploadStatus}
            </div>
          )}

          {uploadError && (
            <div className="bg-destructive/20 border border-destructive/40 rounded-md p-2 text-xs text-destructive flex items-center gap-2">
              <HiExclamationTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {uploadError}
            </div>
          )}

          {docsLoading && (
            <div className="flex items-center gap-2 py-2">
              <HiArrowPath className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading documents...</span>
            </div>
          )}

          {!docsLoading && documents.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">No documents in knowledge base yet.</p>
          )}

          {!docsLoading && documents.length > 0 && (
            <div className="space-y-1.5">
              {documents.map((doc, i) => (
                <div key={i} className="flex items-center justify-between bg-secondary/40 rounded-md px-3 py-2 border border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <HiDocumentText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs truncate">{doc?.fileName ?? 'Unknown'}</span>
                    {doc?.status && (
                      <Badge variant="secondary" className="text-xs">{doc.status}</Badge>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteDoc(doc?.fileName ?? '')}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 flex-shrink-0"
                  >
                    <HiTrash className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Settings Screen ───
function SettingsScreen() {
  const [summaryLength, setSummaryLength] = useState(true)
  const [includeActionItems, setIncludeActionItems] = useState(true)
  const [includeRisks, setIncludeRisks] = useState(true)
  const [autoProcess, setAutoProcess] = useState(false)

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Integrations */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Integrations</CardTitle>
          <CardDescription className="text-xs">Calendar and meeting platform connections</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="flex items-center justify-between bg-secondary/40 rounded-md p-3 border border-border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-accent/20 flex items-center justify-center">
                <HiCalendar className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium">Google Calendar</p>
                <p className="text-xs text-muted-foreground">Calendar event data and metadata</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-xs text-green-400 font-medium">Connected</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-secondary/40 rounded-md p-3 border border-border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-accent/20 flex items-center justify-center">
                <HiUserGroup className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium">Microsoft Teams</p>
                <p className="text-xs text-muted-foreground">Meeting transcripts and recordings</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-xs text-green-400 font-medium">Connected</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Preferences */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Summary Preferences</CardTitle>
          <CardDescription className="text-xs">Customize what gets included in meeting notes</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Detailed Summaries</Label>
              <p className="text-xs text-muted-foreground">Generate comprehensive meeting summaries</p>
            </div>
            <Switch checked={summaryLength} onCheckedChange={setSummaryLength} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Include Action Items</Label>
              <p className="text-xs text-muted-foreground">Extract and list all action items</p>
            </div>
            <Switch checked={includeActionItems} onCheckedChange={setIncludeActionItems} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Include Risks & Blockers</Label>
              <p className="text-xs text-muted-foreground">Identify and flag risks and blockers</p>
            </div>
            <Switch checked={includeRisks} onCheckedChange={setIncludeRisks} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Auto-Process New Meetings</Label>
              <p className="text-xs text-muted-foreground">Automatically process meetings when they end</p>
            </div>
            <Switch checked={autoProcess} onCheckedChange={setAutoProcess} />
          </div>
        </CardContent>
      </Card>

      {/* Agent Status */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Agent Status</CardTitle>
          <CardDescription className="text-xs">AI agents powering this application</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-2">
            {AGENTS.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between bg-secondary/40 rounded-md p-2.5 border border-border">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{agent.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{agent.purpose}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  <span className="text-xs text-green-400">Online</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page ───
export default function Page() {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('dashboard')
  const [meetings, setMeetings] = useState<LocalMeeting[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<LocalMeeting | null>(null)
  const [processedNotes, setProcessedNotes] = useState<ProcessedMeeting | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [meetingInput, setMeetingInput] = useState('')
  const [processError, setProcessError] = useState<string | null>(null)
  const [showSampleData, setShowSampleData] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [excerptView, setExcerptView] = useState<{ excerpt: string; title: string } | null>(null)

  useEffect(() => {
    if (showSampleData) {
      setMeetings(SAMPLE_MEETINGS)
    } else {
      setMeetings([])
      setSelectedMeeting(null)
    }
  }, [showSampleData])

  const processMeeting = async (message: string, meetingId?: string) => {
    setIsProcessing(true)
    setProcessError(null)
    setActiveAgentId(MANAGER_AGENT_ID)
    try {
      const result = await callAIAgent(message, MANAGER_AGENT_ID)
      if (result.success) {
        const parsed = parseAgentResponse<ProcessedMeeting>(result)
        if (parsed) {
          setProcessedNotes(parsed)
          if (meetingId) {
            setMeetings((prev) =>
              prev.map((m) =>
                m.id === meetingId ? { ...m, status: 'processed' as const, processedData: parsed } : m
              )
            )
          }
          setActiveScreen('notes')
        } else {
          const fallbackData = result?.response?.result
          if (fallbackData && typeof fallbackData === 'object' && (fallbackData as any)?.summary) {
            const fd = fallbackData as ProcessedMeeting
            setProcessedNotes(fd)
            if (meetingId) {
              setMeetings((prev) =>
                prev.map((m) =>
                  m.id === meetingId ? { ...m, status: 'processed' as const, processedData: fd } : m
                )
              )
            }
            setActiveScreen('notes')
          } else {
            setProcessError('Could not parse meeting processing results. The agent returned an unexpected format.')
          }
        }
      } else {
        setProcessError(result?.error ?? 'Meeting processing failed. Please try again.')
      }
    } catch {
      setProcessError('Network error during processing.')
    }
    setIsProcessing(false)
    setActiveAgentId(null)
  }

  const handleProcessMeeting = (meeting: LocalMeeting) => {
    const message = `Process this meeting:\nTitle: ${meeting.title}\nDate: ${meeting.date} ${meeting.time}\nOrganizer: ${meeting.organizer}\nAttendees: ${meeting.attendees}\nDescription: ${meeting.description}`
    processMeeting(message, meeting.id)
  }

  const handleProcessCustom = () => {
    if (!meetingInput.trim()) return
    const customId = `custom-${Date.now()}`
    const newMeeting: LocalMeeting = {
      id: customId,
      title: 'Custom Meeting',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attendees: 0,
      organizer: 'You',
      status: 'pending',
      description: meetingInput.slice(0, 200),
    }
    setMeetings((prev) => [newMeeting, ...prev])
    processMeeting(meetingInput.trim(), customId)
    setMeetingInput('')
  }

  const handleViewSampleNotes = () => {
    setProcessedNotes(SAMPLE_PROCESSED)
    setActiveScreen('notes')
  }

  const handleViewExcerpt = (excerpt: string, title: string) => {
    setExcerptView({ excerpt, title })
  }

  const screenTitle = activeScreen === 'dashboard' ? 'Dashboard' : activeScreen === 'notes' ? 'Meeting Notes' : activeScreen === 'history' ? 'Meeting History' : 'Settings'

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        <SidebarNav
          activeScreen={activeScreen}
          onNavigate={setActiveScreen}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(false)}
        />

        <div className="lg:ml-64 min-h-screen">
          <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-1.5 rounded-md hover:bg-secondary transition-colors"
                >
                  <HiBars3 className="h-5 w-5" />
                </button>
                <h2 className="text-sm font-semibold">{screenTitle}</h2>
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground">Sample Data</Label>
                <Switch
                  checked={showSampleData}
                  onCheckedChange={setShowSampleData}
                />
              </div>
            </div>
          </header>

          <main className="p-4">
            {processError && (
              <div className="mb-4 bg-destructive/20 border border-destructive/40 rounded-md p-3 flex items-start gap-2">
                <HiExclamationTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-destructive">{processError}</p>
                </div>
                <button onClick={() => setProcessError(null)} className="text-destructive hover:text-destructive/80 flex-shrink-0">
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>
            )}

            {excerptView && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setExcerptView(null)}>
                <Card className="max-w-lg w-full border-border" onClick={(e) => e.stopPropagation()}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{excerptView.title}</CardTitle>
                      <button onClick={() => setExcerptView(null)} className="text-muted-foreground hover:text-foreground">
                        <HiXMark className="h-4 w-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {renderMarkdown(excerptView.excerpt)}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeScreen === 'dashboard' && (
              <>
                {showSampleData && (
                  <div className="mb-4">
                    <Button variant="outline" size="sm" onClick={handleViewSampleNotes}>
                      <HiDocumentText className="h-4 w-4 mr-1.5" />
                      View Sample Processed Notes
                    </Button>
                  </div>
                )}
                <DashboardScreen
                  meetings={meetings}
                  selectedMeeting={selectedMeeting}
                  onSelectMeeting={setSelectedMeeting}
                  onProcessMeeting={handleProcessMeeting}
                  isProcessing={isProcessing}
                  activeAgentId={activeAgentId}
                  meetingInput={meetingInput}
                  onMeetingInputChange={setMeetingInput}
                  onProcessCustom={handleProcessCustom}
                />
              </>
            )}

            {activeScreen === 'notes' && (
              <NotesScreen
                processedData={processedNotes}
                onBack={() => setActiveScreen('dashboard')}
              />
            )}

            {activeScreen === 'history' && (
              <HistoryScreen
                onViewExcerpt={handleViewExcerpt}
              />
            )}

            {activeScreen === 'settings' && <SettingsScreen />}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}
