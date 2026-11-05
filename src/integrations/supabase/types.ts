export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          agent: string | null
          created_at: string
          details: Json
          id: string
          incident_id: string | null
          message: string
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          agent?: string | null
          created_at?: string
          details?: Json
          id?: string
          incident_id?: string | null
          message: string
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          agent?: string | null
          created_at?: string
          details?: Json
          id?: string
          incident_id?: string | null
          message?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clusters: {
        Row: {
          created_at: string
          id: string
          is_simulated: boolean
          name: string
          node_count: number
          organization_id: string
          provider: string
          region: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_simulated?: boolean
          name: string
          node_count?: number
          organization_id: string
          provider?: string
          region?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_simulated?: boolean
          name?: string
          node_count?: number
          organization_id?: string
          provider?: string
          region?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clusters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clusters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          detected_at: string
          id: string
          organization_id: string
          reference: string
          resolved_at: string | null
          service_id: string | null
          severity: string
          source: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          detected_at?: string
          id?: string
          organization_id: string
          reference?: string
          resolved_at?: string | null
          service_id?: string | null
          severity?: string
          source?: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          detected_at?: string
          id?: string
          organization_id?: string
          reference?: string
          resolved_at?: string | null
          service_id?: string | null
          severity?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      infrastructure_resources: {
        Row: {
          created_at: string
          id: string
          is_simulated: boolean
          kind: string
          metadata: Json
          name: string
          organization_id: string
          service_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_simulated?: boolean
          kind: string
          metadata?: Json
          name: string
          organization_id: string
          service_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_simulated?: boolean
          kind?: string
          metadata?: Json
          name?: string
          organization_id?: string
          service_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "infrastructure_resources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infrastructure_resources_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infrastructure_resources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_evidence: {
        Row: {
          created_at: string
          data: Json
          detail: string | null
          id: string
          investigation_id: string
          kind: string
          organization_id: string
          source: string
          title: string
          weight: number
        }
        Insert: {
          created_at?: string
          data?: Json
          detail?: string | null
          id?: string
          investigation_id: string
          kind: string
          organization_id: string
          source: string
          title: string
          weight?: number
        }
        Update: {
          created_at?: string
          data?: Json
          detail?: string | null
          id?: string
          investigation_id?: string
          kind?: string
          organization_id?: string
          source?: string
          title?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "investigation_evidence_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investigations: {
        Row: {
          completed_at: string | null
          confidence: number | null
          engine: string
          id: string
          incident_id: string
          organization_id: string
          root_cause: string | null
          stages: Json
          started_at: string
          started_by: string | null
          status: string
          summary: string | null
        }
        Insert: {
          completed_at?: string | null
          confidence?: number | null
          engine?: string
          id?: string
          incident_id: string
          organization_id: string
          root_cause?: string | null
          stages?: Json
          started_at?: string
          started_by?: string | null
          status?: string
          summary?: string | null
        }
        Update: {
          completed_at?: string | null
          confidence?: number | null
          engine?: string
          id?: string
          incident_id?: string
          organization_id?: string
          root_cause?: string | null
          stages?: Json
          started_at?: string
          started_by?: string | null
          status?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investigations_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          join_code: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          job_title: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          job_title?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          job_title?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      remediation_approvals: {
        Row: {
          comment: string | null
          created_at: string
          decided_by: string
          decision: string
          id: string
          organization_id: string
          plan_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          decided_by: string
          decision: string
          id?: string
          organization_id: string
          plan_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          decided_by?: string
          decision?: string
          id?: string
          organization_id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediation_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediation_approvals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "remediation_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      remediation_plans: {
        Row: {
          action: string
          created_at: string
          executed_at: string | null
          executed_by: string | null
          execution_log: Json
          id: string
          incident_id: string
          investigation_id: string | null
          organization_id: string
          rationale: string | null
          risk: string
          status: string
          steps: Json
          title: string
          updated_at: string
          verification: Json | null
          verified_at: string | null
        }
        Insert: {
          action: string
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          execution_log?: Json
          id?: string
          incident_id: string
          investigation_id?: string | null
          organization_id: string
          rationale?: string | null
          risk?: string
          status?: string
          steps?: Json
          title: string
          updated_at?: string
          verification?: Json | null
          verified_at?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          execution_log?: Json
          id?: string
          incident_id?: string
          investigation_id?: string | null
          organization_id?: string
          rationale?: string | null
          risk?: string
          status?: string
          steps?: Json
          title?: string
          updated_at?: string
          verification?: Json | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remediation_plans_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediation_plans_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediation_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          description: string
          event_type: string
          id: string
          incident_id: string | null
          is_simulated: boolean
          organization_id: string
          service_id: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          description: string
          event_type: string
          id?: string
          incident_id?: string | null
          is_simulated?: boolean
          organization_id: string
          service_id?: string | null
          severity?: string
        }
        Update: {
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          incident_id?: string | null
          is_simulated?: boolean
          organization_id?: string
          service_id?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          cluster_id: string | null
          cpu_baseline: number
          created_at: string
          current_version: string | null
          id: string
          is_simulated: boolean
          name: string
          namespace: string
          organization_id: string
          previous_version: string | null
          ready_replicas: number
          replicas: number
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cluster_id?: string | null
          cpu_baseline?: number
          created_at?: string
          current_version?: string | null
          id?: string
          is_simulated?: boolean
          name: string
          namespace?: string
          organization_id: string
          previous_version?: string | null
          ready_replicas?: number
          replicas?: number
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cluster_id?: string | null
          cpu_baseline?: number
          created_at?: string
          current_version?: string | null
          id?: string
          is_simulated?: boolean
          name?: string
          namespace?: string
          organization_id?: string
          previous_version?: string | null
          ready_replicas?: number
          replicas?: number
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          incident_id: string | null
          organization_id: string
          scenario: string
          service_id: string | null
          status: string
          telemetry: Json
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string | null
          organization_id: string
          scenario: string
          service_id?: string | null
          status?: string
          telemetry?: Json
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string | null
          organization_id?: string
          scenario?: string
          service_id?: string | null
          status?: string
          telemetry?: Json
        }
        Relationships: [
          {
            foreignKeyName: "simulation_runs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_runs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          environment: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org: { Args: never; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      seed_organization: {
        Args: { _org: string; _ws: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "sre" | "security_analyst" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "sre", "security_analyst", "viewer"],
    },
  },
} as const
