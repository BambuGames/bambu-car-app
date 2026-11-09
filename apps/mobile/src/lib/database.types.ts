
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
            "galleries": {
                  Row: {
                    "created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
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
                    "capture": NonNullable<Json>,"captured_at": string,"created_at": string,"gallery_id": string,"id": string,"original_path": string,"qc": NonNullable<Json>,"slot": string,"updated_at": string,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capture"?: NonNullable<Json>,"captured_at": string,"created_at"?: string,"gallery_id": string,"id": string,"original_path": string,"qc"?: NonNullable<Json>,"slot": string,"updated_at"?: string,"vehicle_id": string
                  }
                  Update: {
                    "capture"?: NonNullable<Json>,"captured_at"?: string,"created_at"?: string,"gallery_id"?: string,"id"?: string,"original_path"?: string,"qc"?: NonNullable<Json>,"slot"?: string,"updated_at"?: string,"vehicle_id"?: string
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
                    "body_type": Database["public"]['Enums']["body_type"],"created_at": string,"created_by": string | null,"details": NonNullable<Json>,"gallery_id": string,"id": string,"make": string,"model": string,"status": Database["public"]['Enums']["vehicle_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_type": Database["public"]['Enums']["body_type"],"created_at"?: string,"created_by"?: string | null,"details"?: NonNullable<Json>,"gallery_id": string,"id"?: string,"make": string,"model": string,"status"?: Database["public"]['Enums']["vehicle_status"],"updated_at"?: string
                  }
                  Update: {
                    "body_type"?: Database["public"]['Enums']["body_type"],"created_at"?: string,"created_by"?: string | null,"details"?: NonNullable<Json>,"gallery_id"?: string,"id"?: string,"make"?: string,"model"?: string,"status"?: Database["public"]['Enums']["vehicle_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
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
                           }
          }
          Enums: {
            "body_type": "sedan"|"kombi"|"suv"|"hatchback"|"other","member_role": "owner"|"staff","vehicle_status": "draft"|"shooting"|"processing"|"ready"|"archived"
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
            "body_type": ["sedan", "kombi", "suv", "hatchback", "other"],"member_role": ["owner", "staff"],"vehicle_status": ["draft", "shooting", "processing", "ready", "archived"]
          }
        }
} as const
