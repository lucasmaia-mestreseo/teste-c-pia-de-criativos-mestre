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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          completion_tokens: number | null
          cost_usd: number | null
          created_at: string
          duration_ms: number | null
          function_name: string
          id: string
          model: string
          project_id: string | null
          prompt_tokens: number | null
          settings_key: string | null
          status_code: number | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          function_name: string
          id?: string
          model: string
          project_id?: string | null
          prompt_tokens?: number | null
          settings_key?: string | null
          status_code?: number | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          function_name?: string
          id?: string
          model?: string
          project_id?: string | null
          prompt_tokens?: number | null
          settings_key?: string | null
          status_code?: number | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      brand_kits: {
        Row: {
          aux_colors: string[] | null
          background_color: string | null
          colors: string[] | null
          created_at: string
          design_screenshot_url: string | null
          id: string
          logo_analysis: string | null
          logo_analysis_source: string | null
          logo_url: string | null
          people_photos: string[] | null
          person_grid_url: string | null
          photos: string[] | null
          primary_color: string | null
          project_id: string
          secondary_color: string | null
          typography: string | null
          updated_at: string
        }
        Insert: {
          aux_colors?: string[] | null
          background_color?: string | null
          colors?: string[] | null
          created_at?: string
          design_screenshot_url?: string | null
          id?: string
          logo_analysis?: string | null
          logo_analysis_source?: string | null
          logo_url?: string | null
          people_photos?: string[] | null
          person_grid_url?: string | null
          photos?: string[] | null
          primary_color?: string | null
          project_id: string
          secondary_color?: string | null
          typography?: string | null
          updated_at?: string
        }
        Update: {
          aux_colors?: string[] | null
          background_color?: string | null
          colors?: string[] | null
          created_at?: string
          design_screenshot_url?: string | null
          id?: string
          logo_analysis?: string | null
          logo_analysis_source?: string | null
          logo_url?: string | null
          people_photos?: string[] | null
          person_grid_url?: string | null
          photos?: string[] | null
          primary_color?: string | null
          project_id?: string
          secondary_color?: string | null
          typography?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_formats: {
        Row: {
          active: boolean
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string
          error_details: Json | null
          error_message: string | null
          function_name: string
          id: string
          model: string | null
          project_id: string | null
          request_id: string | null
          source: string | null
          stage: string | null
          status_code: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          function_name: string
          id?: string
          model?: string | null
          project_id?: string | null
          request_id?: string | null
          source?: string | null
          stage?: string | null
          status_code?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          function_name?: string
          id?: string
          model?: string | null
          project_id?: string | null
          request_id?: string | null
          source?: string | null
          stage?: string | null
          status_code?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_creatives: {
        Row: {
          briefing: Json | null
          cost_usd: number | null
          created_at: string
          created_by: string | null
          favorite: boolean
          format: string
          generation_meta: Json | null
          id: string
          image_url: string
          kind: string
          model_used: string | null
          parent_creative_id: string | null
          project_id: string
          prompt: string
          review: Json | null
          review_status: string | null
          source_image_url: string | null
          swipe_file_id: string | null
        }
        Insert: {
          briefing?: Json | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          favorite?: boolean
          format: string
          generation_meta?: Json | null
          id?: string
          image_url: string
          kind?: string
          model_used?: string | null
          parent_creative_id?: string | null
          project_id: string
          prompt: string
          review?: Json | null
          review_status?: string | null
          source_image_url?: string | null
          swipe_file_id?: string | null
        }
        Update: {
          briefing?: Json | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          favorite?: boolean
          format?: string
          generation_meta?: Json | null
          id?: string
          image_url?: string
          kind?: string
          model_used?: string | null
          parent_creative_id?: string | null
          project_id?: string
          prompt?: string
          review?: Json | null
          review_status?: string | null
          source_image_url?: string | null
          swipe_file_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_creatives_parent_creative_id_fkey"
            columns: ["parent_creative_id"]
            isOneToOne: false
            referencedRelation: "generated_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_creatives_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_creatives_swipe_file_id_fkey"
            columns: ["swipe_file_id"]
            isOneToOne: false
            referencedRelation: "swipe_files"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          active: boolean
          context: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          onboarding_completed: boolean
          updated_at: string
          voice_guide: string | null
        }
        Insert: {
          active?: boolean
          context?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          onboarding_completed?: boolean
          updated_at?: string
          voice_guide?: string | null
        }
        Update: {
          active?: boolean
          context?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          onboarding_completed?: boolean
          updated_at?: string
          voice_guide?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          enabled: boolean
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          enabled?: boolean
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          enabled?: boolean
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      swipe_files: {
        Row: {
          analysis: Json | null
          created_at: string
          height: number | null
          id: string
          image_url: string
          name: string
          project_id: string
          width: number | null
        }
        Insert: {
          analysis?: Json | null
          created_at?: string
          height?: number | null
          id?: string
          image_url: string
          name: string
          project_id: string
          width?: number | null
        }
        Update: {
          analysis?: Json | null
          created_at?: string
          height?: number | null
          id?: string
          image_url?: string
          name?: string
          project_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "swipe_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      template_prompts: {
        Row: {
          base_image_url: string | null
          id: string
          prompt: string
          style_prompt: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_image_url?: string | null
          id: string
          prompt: string
          style_prompt?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_image_url?: string | null
          id?: string
          prompt?: string
          style_prompt?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_downloads: {
        Row: {
          created_at: string
          creative_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creative_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creative_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
        }
        Relationships: []
      }
      user_project_access: {
        Row: {
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_project_access_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_assign_role: {
        Args: { _actor: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      can_manage_user_target: {
        Args: { _actor: string; _target: string }
        Returns: boolean
      }
      can_manage_users: { Args: { _actor: string }; Returns: boolean }
      has_any_admin_role: { Args: { _user_id: string }; Returns: boolean }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_project_access: { Args: { _user_id: string }; Returns: boolean }
      has_project_admin: { Args: { _actor: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      max_role_rank: { Args: { _user_id: string }; Returns: number }
      user_can_access_project: {
        Args: { _project: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "analyst"
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
      app_role: ["owner", "admin", "manager", "analyst"],
    },
  },
} as const
