
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "backgrounds": {
                  Row: {
                    "gallery_id": string | null,"id": string,"name": string,"sort_order": number,"spec": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "gallery_id"?: string | null,"id"?: string,"name": string,"sort_order"?: number,"spec": NonNullable<Json>
                  }
                  Update: {
                    "gallery_id"?: string | null,"id"?: string,"name"?: string,"sort_order"?: number,"spec"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "backgrounds_gallery_id_fkey"
      columns: ["gallery_id"]
isOneToOne: false
      referencedRelation: "galleries"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_ledger": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"gallery_id": string,"id": number,"note": string | null,"reason": Database["public"]['Enums']["credit_reason"],"vehicle_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"gallery_id": string,"id"?: never,"note"?: string | null,"reason": Database["public"]['Enums']["credit_reason"],"vehicle_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"gallery_id"?: string,"id"?: never,"note"?: string | null,"reason"?: Database["public"]['Enums']["credit_reason"],"vehicle_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_ledger_gallery_id_fkey"
      columns: ["gallery_id"]
isOneToOne: false
      referencedRelation: "galleries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "credit_ledger_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"galleries": {
                  Row: {
                    "banner_path": string | null,"created_at": string,"default_background_id": string | null,"id": string,"logo_path": string | null,"name": string,"watermark": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "banner_path"?: string | null,"created_at"?: string,"default_background_id"?: string | null,"id"?: string,"logo_path"?: string | null,"name": string,"watermark"?: NonNullable<Json>
                  }
                  Update: {
                    "banner_path"?: string | null,"created_at"?: string,"default_background_id"?: string | null,"id"?: string,"logo_path"?: string | null,"name"?: string,"watermark"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "galleries_default_background_id_fkey"
      columns: ["default_background_id"]
isOneToOne: false
      referencedRelation: "backgrounds"
      referencedColumns: ["id"]
    }
                  ]
                },"gallery_members": {
                  Row: {
                    "created_at": string,"gallery_id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gallery_id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"gallery_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gallery_members_gallery_id_fkey"
      columns: ["gallery_id"]
isOneToOne: false
      referencedRelation: "galleries"
      referencedColumns: ["id"]
    }
                  ]
                },"makes": {
                  Row: {
                    "id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"name": string
                  }
                  Update: {
                    "id"?: never,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"models": {
                  Row: {
                    "id": number,"make_id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"make_id": number,"name": string
                  }
                  Update: {
                    "id"?: never,"make_id"?: number,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "models_make_id_fkey"
      columns: ["make_id"]
isOneToOne: false
      referencedRelation: "makes"
      referencedColumns: ["id"]
    }
                  ]
                },"photos": {
                  Row: {
                    "capture": NonNullable<Json>,"captured_at": string,"created_at": string,"gallery_id": string,"id": string,"mask_edits": NonNullable<Json>,"mask_path": string | null,"original_path": string,"output_path": string | null,"output_wm_path": string | null,"placement": Json | null,"plate_corners": Json | null,"plate_status": Database["public"]['Enums']["plate_status"] | null,"process_error": string | null,"process_status": Database["public"]['Enums']["photo_process_status"],"processed_at": string | null,"qc": NonNullable<Json>,"slot": string,"tone_stats": Json | null,"updated_at": string,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capture"?: NonNullable<Json>,"captured_at": string,"created_at"?: string,"gallery_id": string,"id": string,"mask_edits"?: NonNullable<Json>,"mask_path"?: string | null,"original_path": string,"output_path"?: string | null,"output_wm_path"?: string | null,"placement"?: Json | null,"plate_corners"?: Json | null,"plate_status"?: Database["public"]['Enums']["plate_status"] | null,"process_error"?: string | null,"process_status"?: Database["public"]['Enums']["photo_process_status"],"processed_at"?: string | null,"qc"?: NonNullable<Json>,"slot": string,"tone_stats"?: Json | null,"updated_at"?: string,"vehicle_id": string
                  }
                  Update: {
                    "capture"?: NonNullable<Json>,"captured_at"?: string,"created_at"?: string,"gallery_id"?: string,"id"?: string,"mask_edits"?: NonNullable<Json>,"mask_path"?: string | null,"original_path"?: string,"output_path"?: string | null,"output_wm_path"?: string | null,"placement"?: Json | null,"plate_corners"?: Json | null,"plate_status"?: Database["public"]['Enums']["plate_status"] | null,"process_error"?: string | null,"process_status"?: Database["public"]['Enums']["photo_process_status"],"processed_at"?: string | null,"qc"?: NonNullable<Json>,"slot"?: string,"tone_stats"?: Json | null,"updated_at"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "photos_vehicle_id_gallery_id_fkey"
      columns: ["vehicle_id","gallery_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id","gallery_id"]
    }
                  ]
                },"vehicles": {
                  Row: {
                    "background_id": string | null,"body_type": Database["public"]['Enums']["body_type"],"created_at": string,"created_by": string | null,"credit_charged_at": string | null,"details": NonNullable<Json>,"gallery_id": string,"id": string,"make": string,"model": string,"status": Database["public"]['Enums']["vehicle_status"],"tone_enabled": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "background_id"?: string | null,"body_type": Database["public"]['Enums']["body_type"],"created_at"?: string,"created_by"?: string | null,"credit_charged_at"?: string | null,"details"?: NonNullable<Json>,"gallery_id": string,"id"?: string,"make": string,"model": string,"status"?: Database["public"]['Enums']["vehicle_status"],"tone_enabled"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "background_id"?: string | null,"body_type"?: Database["public"]['Enums']["body_type"],"created_at"?: string,"created_by"?: string | null,"credit_charged_at"?: string | null,"details"?: NonNullable<Json>,"gallery_id"?: string,"id"?: string,"make"?: string,"model"?: string,"status"?: Database["public"]['Enums']["vehicle_status"],"tone_enabled"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicles_background_id_fkey"
      columns: ["background_id"]
isOneToOne: false
      referencedRelation: "backgrounds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicles_gallery_id_fkey"
      columns: ["gallery_id"]
isOneToOne: false
      referencedRelation: "galleries"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_add_member":
{ Args: { "p_email": string,"p_gallery_id": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: undefined
                           },
"admin_create_gallery":
{ Args: { "p_name": string,"p_owner_email": string }; Returns: string
                           },
"admin_grant_credits":
{ Args: { "p_amount": number,"p_gallery_id": string,"p_note": string }; Returns: number
                           },
"admin_refund_vehicle":
{ Args: { "p_note": string,"p_vehicle_id": string }; Returns: number
                           },
"gallery_credit_balance":
{ Args: { "p_gallery_id": string }; Returns: number
                           },
"start_processing":
{ Args: { "p_photo_id"?: string,"p_rerender"?: boolean,"p_vehicle_id": string }; Returns: (string)[]
                           }
          }
          Enums: {
            "body_type": "sedan"|"kombi"|"suv"|"hatchback"|"other","credit_reason": "grant"|"vehicle"|"refund","member_role": "owner"|"staff","photo_process_status": "unprocessed"|"queued"|"processing"|"done"|"failed","plate_status": "auto"|"needs_check"|"confirmed"|"none","vehicle_status": "draft"|"shooting"|"processing"|"ready"|"archived"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "body_type": ["sedan", "kombi", "suv", "hatchback", "other"],"credit_reason": ["grant", "vehicle", "refund"],"member_role": ["owner", "staff"],"photo_process_status": ["unprocessed", "queued", "processing", "done", "failed"],"plate_status": ["auto", "needs_check", "confirmed", "none"],"vehicle_status": ["draft", "shooting", "processing", "ready", "archived"]
          }
        }
} as const
