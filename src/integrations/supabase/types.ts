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
      audit_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["audit_action"]
          created_at: string
          deal_id: string | null
          exporter_id: string | null
          id: string
          metadata: Json
          user_id: string | null
          user_role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          deal_id?: string | null
          exporter_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          deal_id?: string | null
          exporter_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_exporter_id_fkey"
            columns: ["exporter_id"]
            isOneToOne: false
            referencedRelation: "exporters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_pool_history: {
        Row: {
          action_type: string
          actor_id: string
          amount_change: number
          created_at: string
          id: string
          new_total: number
          note: string | null
        }
        Insert: {
          action_type: string
          actor_id: string
          amount_change: number
          created_at?: string
          id?: string
          new_total: number
          note?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string
          amount_change?: number
          created_at?: string
          id?: string
          new_total?: number
          note?: string | null
        }
        Relationships: []
      }
      capital_tranches: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          date_received: string
          id: string
          notes: string | null
          reference: string
          source_name: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          date_received: string
          id?: string
          notes?: string | null
          reference: string
          source_name: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          date_received?: string
          id?: string
          notes?: string | null
          reference?: string
          source_name?: string
        }
        Relationships: []
      }
      deal_change_requests: {
        Row: {
          created_at: string
          deal_id: string
          fields_flagged: Json
          id: string
          requested_by: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["change_request_status"]
        }
        Insert: {
          created_at?: string
          deal_id: string
          fields_flagged?: Json
          id?: string
          requested_by: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
        }
        Update: {
          created_at?: string
          deal_id?: string
          fields_flagged?: Json
          id?: string
          requested_by?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "deal_change_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_doc_requests: {
        Row: {
          created_at: string
          deal_id: string
          document_type: string
          id: string
          label: string
          notes: string | null
          requested_by: string
          status: string
          updated_at: string
          uploaded_doc_id: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          document_type: string
          id?: string
          label: string
          notes?: string | null
          requested_by: string
          status?: string
          updated_at?: string
          uploaded_doc_id?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          document_type?: string
          id?: string
          label?: string
          notes?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
          uploaded_doc_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_doc_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_doc_requests_uploaded_doc_id_fkey"
            columns: ["uploaded_doc_id"]
            isOneToOne: false
            referencedRelation: "deal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_documents: {
        Row: {
          deal_id: string
          document_type: Database["public"]["Enums"]["deal_document_type"]
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          is_superseded: boolean
          mime_type: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          deal_id: string
          document_type: Database["public"]["Enums"]["deal_document_type"]
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          is_superseded?: boolean
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          deal_id?: string
          document_type?: Database["public"]["Enums"]["deal_document_type"]
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          is_superseded?: boolean
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          actual_repayment_amount: number | null
          actual_repayment_date: string | null
          advance_amount: number | null
          advance_currency: string | null
          advance_percentage: number
          approved_at: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_country: string | null
          bank_name: string | null
          bank_name_match: boolean | null
          bank_sort_code_iban: string | null
          buyer_company_name: string | null
          buyer_contact_email: string | null
          buyer_contact_name: string | null
          buyer_contact_phone: string | null
          buyer_country: string | null
          buyer_country_of_incorporation: string | null
          buyer_credit_check_status: Database["public"]["Enums"]["buyer_credit_check_status"]
          buyer_name_match: boolean | null
          buyer_sanctions_status: Database["public"]["Enums"]["sanctions_screening_status"]
          buyer_underwriter_notes: string | null
          cbn_repatriation_deadline: string | null
          commodity_type: Database["public"]["Enums"]["commodity_type"] | null
          created_at: string
          deal_reference: string | null
          demurrage_amount: number
          demurrage_rate_daily: number
          disbursement_date: string | null
          discount_fee_amount: number | null
          discount_fee_pct: number | null
          expected_settlement_date: string | null
          export_destination: string | null
          export_licence_document_id: string | null
          export_licence_number: string | null
          exporter_id: string
          exporter_receipt_confirmed_at: string | null
          fee_acceptance_at: string | null
          fee_acceptance_by: string | null
          funded_at: string | null
          fx_rate_at_funding: number | null
          fx_rate_source: string | null
          fx_risk_acknowledged: boolean
          gbp_equivalent: number | null
          goods_description: string | null
          gross_yield: number | null
          hs_code: string | null
          id: string
          incoterms: string | null
          invoice_currency_v2:
            | Database["public"]["Enums"]["invoice_currency"]
            | null
          invoice_date: string | null
          invoice_file_path: string | null
          invoice_number: string | null
          invoice_value: number | null
          ipu_verified: boolean
          ipu_verified_at: string | null
          ipu_verified_by: string | null
          late_penalty_amount: number | null
          licence_name_match: boolean | null
          net_advance_amount: number | null
          ngn_equivalent_at_disbursement: number | null
          offer_accepted_at: string | null
          offer_accepted_by: string | null
          offer_decline_reason: string | null
          offer_declined_at: string | null
          offer_declined_by: string | null
          originator_id: string
          outstanding_balance: number | null
          overdue_days: number
          overdue_days_at_payment: number | null
          parent_deal_id: string | null
          partner_notes: string | null
          partner_organisation_id: string | null
          payment_advice_doc_id: string | null
          payment_amount_received: number | null
          payment_date: string | null
          payment_due_date: string | null
          payment_terms_days: number | null
          platform_fee_amount: number | null
          platform_fee_pct: number | null
          rejected_at: string | null
          rejection_reason: string | null
          repayment_amount: number | null
          repayment_currency_received: string | null
          repayment_due_date: string | null
          repayment_fx_rate: number | null
          repayment_gbp_equivalent: number | null
          repayment_reconciliation_status:
            | Database["public"]["Enums"]["repayment_reconciliation_status"]
            | null
          residual_balance: number | null
          sent_to_veloxis_at: string | null
          settlement_currency: string | null
          settlement_method:
            | Database["public"]["Enums"]["settlement_method_type"]
            | null
          snapshot_advance_rate_pct: number | null
          snapshot_discount_fee_pct: number | null
          snapshot_late_penalty_rate_pct: number | null
          snapshot_platform_fee_pct: number | null
          status: Database["public"]["Enums"]["deal_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          actual_repayment_amount?: number | null
          actual_repayment_date?: string | null
          advance_amount?: number | null
          advance_currency?: string | null
          advance_percentage?: number
          approved_at?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_country?: string | null
          bank_name?: string | null
          bank_name_match?: boolean | null
          bank_sort_code_iban?: string | null
          buyer_company_name?: string | null
          buyer_contact_email?: string | null
          buyer_contact_name?: string | null
          buyer_contact_phone?: string | null
          buyer_country?: string | null
          buyer_country_of_incorporation?: string | null
          buyer_credit_check_status?: Database["public"]["Enums"]["buyer_credit_check_status"]
          buyer_name_match?: boolean | null
          buyer_sanctions_status?: Database["public"]["Enums"]["sanctions_screening_status"]
          buyer_underwriter_notes?: string | null
          cbn_repatriation_deadline?: string | null
          commodity_type?: Database["public"]["Enums"]["commodity_type"] | null
          created_at?: string
          deal_reference?: string | null
          demurrage_amount?: number
          demurrage_rate_daily?: number
          disbursement_date?: string | null
          discount_fee_amount?: number | null
          discount_fee_pct?: number | null
          expected_settlement_date?: string | null
          export_destination?: string | null
          export_licence_document_id?: string | null
          export_licence_number?: string | null
          exporter_id: string
          exporter_receipt_confirmed_at?: string | null
          fee_acceptance_at?: string | null
          fee_acceptance_by?: string | null
          funded_at?: string | null
          fx_rate_at_funding?: number | null
          fx_rate_source?: string | null
          fx_risk_acknowledged?: boolean
          gbp_equivalent?: number | null
          goods_description?: string | null
          gross_yield?: number | null
          hs_code?: string | null
          id?: string
          incoterms?: string | null
          invoice_currency_v2?:
            | Database["public"]["Enums"]["invoice_currency"]
            | null
          invoice_date?: string | null
          invoice_file_path?: string | null
          invoice_number?: string | null
          invoice_value?: number | null
          ipu_verified?: boolean
          ipu_verified_at?: string | null
          ipu_verified_by?: string | null
          late_penalty_amount?: number | null
          licence_name_match?: boolean | null
          net_advance_amount?: number | null
          ngn_equivalent_at_disbursement?: number | null
          offer_accepted_at?: string | null
          offer_accepted_by?: string | null
          offer_decline_reason?: string | null
          offer_declined_at?: string | null
          offer_declined_by?: string | null
          originator_id: string
          outstanding_balance?: number | null
          overdue_days?: number
          overdue_days_at_payment?: number | null
          parent_deal_id?: string | null
          partner_notes?: string | null
          partner_organisation_id?: string | null
          payment_advice_doc_id?: string | null
          payment_amount_received?: number | null
          payment_date?: string | null
          payment_due_date?: string | null
          payment_terms_days?: number | null
          platform_fee_amount?: number | null
          platform_fee_pct?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          repayment_amount?: number | null
          repayment_currency_received?: string | null
          repayment_due_date?: string | null
          repayment_fx_rate?: number | null
          repayment_gbp_equivalent?: number | null
          repayment_reconciliation_status?:
            | Database["public"]["Enums"]["repayment_reconciliation_status"]
            | null
          residual_balance?: number | null
          sent_to_veloxis_at?: string | null
          settlement_currency?: string | null
          settlement_method?:
            | Database["public"]["Enums"]["settlement_method_type"]
            | null
          snapshot_advance_rate_pct?: number | null
          snapshot_discount_fee_pct?: number | null
          snapshot_late_penalty_rate_pct?: number | null
          snapshot_platform_fee_pct?: number | null
          status?: Database["public"]["Enums"]["deal_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          actual_repayment_amount?: number | null
          actual_repayment_date?: string | null
          advance_amount?: number | null
          advance_currency?: string | null
          advance_percentage?: number
          approved_at?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_country?: string | null
          bank_name?: string | null
          bank_name_match?: boolean | null
          bank_sort_code_iban?: string | null
          buyer_company_name?: string | null
          buyer_contact_email?: string | null
          buyer_contact_name?: string | null
          buyer_contact_phone?: string | null
          buyer_country?: string | null
          buyer_country_of_incorporation?: string | null
          buyer_credit_check_status?: Database["public"]["Enums"]["buyer_credit_check_status"]
          buyer_name_match?: boolean | null
          buyer_sanctions_status?: Database["public"]["Enums"]["sanctions_screening_status"]
          buyer_underwriter_notes?: string | null
          cbn_repatriation_deadline?: string | null
          commodity_type?: Database["public"]["Enums"]["commodity_type"] | null
          created_at?: string
          deal_reference?: string | null
          demurrage_amount?: number
          demurrage_rate_daily?: number
          disbursement_date?: string | null
          discount_fee_amount?: number | null
          discount_fee_pct?: number | null
          expected_settlement_date?: string | null
          export_destination?: string | null
          export_licence_document_id?: string | null
          export_licence_number?: string | null
          exporter_id?: string
          exporter_receipt_confirmed_at?: string | null
          fee_acceptance_at?: string | null
          fee_acceptance_by?: string | null
          funded_at?: string | null
          fx_rate_at_funding?: number | null
          fx_rate_source?: string | null
          fx_risk_acknowledged?: boolean
          gbp_equivalent?: number | null
          goods_description?: string | null
          gross_yield?: number | null
          hs_code?: string | null
          id?: string
          incoterms?: string | null
          invoice_currency_v2?:
            | Database["public"]["Enums"]["invoice_currency"]
            | null
          invoice_date?: string | null
          invoice_file_path?: string | null
          invoice_number?: string | null
          invoice_value?: number | null
          ipu_verified?: boolean
          ipu_verified_at?: string | null
          ipu_verified_by?: string | null
          late_penalty_amount?: number | null
          licence_name_match?: boolean | null
          net_advance_amount?: number | null
          ngn_equivalent_at_disbursement?: number | null
          offer_accepted_at?: string | null
          offer_accepted_by?: string | null
          offer_decline_reason?: string | null
          offer_declined_at?: string | null
          offer_declined_by?: string | null
          originator_id?: string
          outstanding_balance?: number | null
          overdue_days?: number
          overdue_days_at_payment?: number | null
          parent_deal_id?: string | null
          partner_notes?: string | null
          partner_organisation_id?: string | null
          payment_advice_doc_id?: string | null
          payment_amount_received?: number | null
          payment_date?: string | null
          payment_due_date?: string | null
          payment_terms_days?: number | null
          platform_fee_amount?: number | null
          platform_fee_pct?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          repayment_amount?: number | null
          repayment_currency_received?: string | null
          repayment_due_date?: string | null
          repayment_fx_rate?: number | null
          repayment_gbp_equivalent?: number | null
          repayment_reconciliation_status?:
            | Database["public"]["Enums"]["repayment_reconciliation_status"]
            | null
          residual_balance?: number | null
          sent_to_veloxis_at?: string | null
          settlement_currency?: string | null
          settlement_method?:
            | Database["public"]["Enums"]["settlement_method_type"]
            | null
          snapshot_advance_rate_pct?: number | null
          snapshot_discount_fee_pct?: number | null
          snapshot_late_penalty_rate_pct?: number | null
          snapshot_platform_fee_pct?: number | null
          status?: Database["public"]["Enums"]["deal_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_export_licence_document_id_fkey"
            columns: ["export_licence_document_id"]
            isOneToOne: false
            referencedRelation: "exporter_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_exporter_id_fkey"
            columns: ["exporter_id"]
            isOneToOne: false
            referencedRelation: "exporters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_fee_acceptance_by_fkey"
            columns: ["fee_acceptance_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_originator_id_fkey"
            columns: ["originator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_parent_deal_id_fkey"
            columns: ["parent_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_partner_organisation_id_fkey"
            columns: ["partner_organisation_id"]
            isOneToOne: false
            referencedRelation: "partner_organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_payment_advice_doc_id_fkey"
            columns: ["payment_advice_doc_id"]
            isOneToOne: false
            referencedRelation: "deal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          created_at: string
          description: string | null
          document_title: string
          expiry_required: boolean
          exporter_id: string
          fulfilled_at: string | null
          id: string
          partner_organisation_id: string | null
          requested_by: string
          status: Database["public"]["Enums"]["document_request_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_title: string
          expiry_required?: boolean
          exporter_id: string
          fulfilled_at?: string | null
          id?: string
          partner_organisation_id?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["document_request_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          document_title?: string
          expiry_required?: boolean
          exporter_id?: string
          fulfilled_at?: string | null
          id?: string
          partner_organisation_id?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["document_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_exporter_id_fkey"
            columns: ["exporter_id"]
            isOneToOne: false
            referencedRelation: "exporters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_partner_organisation_id_fkey"
            columns: ["partner_organisation_id"]
            isOneToOne: false
            referencedRelation: "partner_organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exporter_bank_accounts: {
        Row: {
          account_currency: string | null
          account_name: string
          account_number: string
          bank_country: string
          bank_name: string
          created_at: string
          exporter_id: string
          id: string
          is_default: boolean
          is_verified: boolean
          proof_document_path: string | null
          sort_code_iban: string
          swift_bic: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_currency?: string | null
          account_name: string
          account_number: string
          bank_country: string
          bank_name: string
          created_at?: string
          exporter_id: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          proof_document_path?: string | null
          sort_code_iban: string
          swift_bic?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_currency?: string | null
          account_name?: string
          account_number?: string
          bank_country?: string
          bank_name?: string
          created_at?: string
          exporter_id?: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          proof_document_path?: string | null
          sort_code_iban?: string
          swift_bic?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exporter_bank_accounts_exporter_id_fkey"
            columns: ["exporter_id"]
            isOneToOne: false
            referencedRelation: "exporters"
            referencedColumns: ["id"]
          },
        ]
      }
      exporter_documents: {
        Row: {
          document_request_id: string | null
          document_status: string
          document_type: Database["public"]["Enums"]["exporter_document_type"]
          expiry_date: string | null
          expiry_status: Database["public"]["Enums"]["expiry_status"]
          exporter_id: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          is_superseded: boolean
          mime_type: string | null
          uploaded_at: string
          uploaded_by_role: string | null
          uploaded_by_token_id: string | null
          uploaded_by_user_id: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          document_request_id?: string | null
          document_status?: string
          document_type: Database["public"]["Enums"]["exporter_document_type"]
          expiry_date?: string | null
          expiry_status?: Database["public"]["Enums"]["expiry_status"]
          exporter_id: string
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          is_superseded?: boolean
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by_role?: string | null
          uploaded_by_token_id?: string | null
          uploaded_by_user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          document_request_id?: string | null
          document_status?: string
          document_type?: Database["public"]["Enums"]["exporter_document_type"]
          expiry_date?: string | null
          expiry_status?: Database["public"]["Enums"]["expiry_status"]
          exporter_id?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          is_superseded?: boolean
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by_role?: string | null
          uploaded_by_token_id?: string | null
          uploaded_by_user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exporter_documents_document_request_id_fkey"
            columns: ["document_request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exporter_documents_exporter_id_fkey"
            columns: ["exporter_id"]
            isOneToOne: false
            referencedRelation: "exporters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exporter_documents_uploaded_by_token_id_fkey"
            columns: ["uploaded_by_token_id"]
            isOneToOne: false
            referencedRelation: "exporter_upload_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exporter_documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exporter_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exporter_upload_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          exporter_id: string
          first_used_at: string | null
          id: string
          is_active: boolean
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          exporter_id: string
          first_used_at?: string | null
          id?: string
          is_active?: boolean
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          exporter_id?: string
          first_used_at?: string | null
          id?: string
          is_active?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "exporter_upload_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exporter_upload_tokens_exporter_id_fkey"
            columns: ["exporter_id"]
            isOneToOne: false
            referencedRelation: "exporters"
            referencedColumns: ["id"]
          },
        ]
      }
      exporters: {
        Row: {
          company_name: string
          contact_email: string | null
          country: string
          created_at: string
          director_name: string
          edd_completed: boolean
          edd_required: boolean
          entity_type: Database["public"]["Enums"]["entity_type"]
          exporter_user_id: string | null
          forwarded_to_veloxis_at: string | null
          forwarded_to_veloxis_by: string | null
          id: string
          invite_accepted_at: string | null
          invite_sent_at: string | null
          is_active: boolean
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          kyc_verified_at: string | null
          kyc_verified_by: string | null
          onboarding_status: Database["public"]["Enums"]["onboarding_status"]
          originator_id: string
          rc_number: string
          sanctions_screening_status: Database["public"]["Enums"]["sanctions_screening_status"]
          source_of_funds_statement: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_email?: string | null
          country?: string
          created_at?: string
          director_name: string
          edd_completed?: boolean
          edd_required?: boolean
          entity_type: Database["public"]["Enums"]["entity_type"]
          exporter_user_id?: string | null
          forwarded_to_veloxis_at?: string | null
          forwarded_to_veloxis_by?: string | null
          id?: string
          invite_accepted_at?: string | null
          invite_sent_at?: string | null
          is_active?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          originator_id: string
          rc_number: string
          sanctions_screening_status?: Database["public"]["Enums"]["sanctions_screening_status"]
          source_of_funds_statement?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_email?: string | null
          country?: string
          created_at?: string
          director_name?: string
          edd_completed?: boolean
          edd_required?: boolean
          entity_type?: Database["public"]["Enums"]["entity_type"]
          exporter_user_id?: string | null
          forwarded_to_veloxis_at?: string | null
          forwarded_to_veloxis_by?: string | null
          id?: string
          invite_accepted_at?: string | null
          invite_sent_at?: string | null
          is_active?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          originator_id?: string
          rc_number?: string
          sanctions_screening_status?: Database["public"]["Enums"]["sanctions_screening_status"]
          source_of_funds_statement?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exporters_kyc_verified_by_fkey"
            columns: ["kyc_verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exporters_originator_id_fkey"
            columns: ["originator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notes: {
        Row: {
          author_id: string
          created_at: string
          deal_id: string
          id: string
          note_body: string
        }
        Insert: {
          author_id: string
          created_at?: string
          deal_id: string
          id?: string
          note_body: string
        }
        Update: {
          author_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          note_body?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      ipus: {
        Row: {
          created_at: string
          deal_id: string
          expires_at: string | null
          hellosign_audit_cert_path: string | null
          hellosign_request_id: string | null
          id: string
          ipu_pdf_path: string | null
          is_active: boolean
          sent_at: string | null
          sent_to_email: string | null
          signed_at: string | null
          signer_name: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          expires_at?: string | null
          hellosign_audit_cert_path?: string | null
          hellosign_request_id?: string | null
          id?: string
          ipu_pdf_path?: string | null
          is_active?: boolean
          sent_at?: string | null
          sent_to_email?: string | null
          signed_at?: string | null
          signer_name?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          expires_at?: string | null
          hellosign_audit_cert_path?: string | null
          hellosign_request_id?: string | null
          id?: string
          ipu_pdf_path?: string | null
          is_active?: boolean
          sent_at?: string | null
          sent_to_email?: string | null
          signed_at?: string | null
          signer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ipus_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_organisations: {
        Row: {
          admin_email: string | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string
        }
        Insert: {
          admin_email?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Update: {
          admin_email?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          advance_rate_pct: number
          discount_fee_pct_monthly: number
          id: string
          late_penalty_rate_pct_daily: number
          max_payment_terms_days: number
          min_payment_terms_days: number
          platform_fee_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          advance_rate_pct?: number
          discount_fee_pct_monthly?: number
          id?: string
          late_penalty_rate_pct_daily?: number
          max_payment_terms_days?: number
          min_payment_terms_days?: number
          platform_fee_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          advance_rate_pct?: number
          discount_fee_pct_monthly?: number
          id?: string
          late_penalty_rate_pct_daily?: number
          max_payment_terms_days?: number
          min_payment_terms_days?: number
          platform_fee_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rate_history: {
        Row: {
          changed_by: string
          created_at: string
          field_name: string
          id: string
          new_value: string
          old_value: string | null
        }
        Insert: {
          changed_by: string
          created_at?: string
          field_name: string
          id?: string
          new_value: string
          old_value?: string | null
        }
        Update: {
          changed_by?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rate_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ubo_declarations: {
        Row: {
          created_at: string
          date_of_birth: string
          exporter_id: string
          full_name: string
          id: string
          nationality: string
          ownership_percentage: number
          residential_address: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth: string
          exporter_id: string
          full_name: string
          id?: string
          nationality: string
          ownership_percentage: number
          residential_address: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string
          exporter_id?: string
          full_name?: string
          id?: string
          nationality?: string
          ownership_percentage?: number
          residential_address?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ubo_declarations_exporter_id_fkey"
            columns: ["exporter_id"]
            isOneToOne: false
            referencedRelation: "exporters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          partner_organisation_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          partner_organisation_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          partner_organisation_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_partner_organisation_id_fkey"
            columns: ["partner_organisation_id"]
            isOneToOne: false
            referencedRelation: "partner_organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          organisation: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          organisation?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          organisation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accrue_demurrage: { Args: { p_deal_id: string }; Returns: undefined }
      calculate_deal_pricing: {
        Args: {
          p_advance_percentage?: number
          p_invoice_value: number
          p_payment_terms_days?: number
          p_subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Returns: {
          advance_amount: number
          discount_fee_amount: number
          discount_fee_pct: number
          gross_expected_yield: number
          net_repayment_target: number
          platform_fee_amount: number
          platform_fee_pct: number
        }[]
      }
      check_pool_availability: {
        Args: { p_advance_amount_gbp: number }
        Returns: {
          available_gbp: number
          deployed_gbp: number
          hard_blocked: boolean
          pool_gbp: number
          warning_triggered: boolean
          would_deploy_gbp: number
        }[]
      }
      get_partner_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_audit_log: {
        Args: {
          p_action_type?: Database["public"]["Enums"]["audit_action"]
          p_deal_id?: string
          p_exporter_id?: string
          p_metadata?: Json
          p_user_id?: string
          p_user_role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      is_originator: { Args: { _user_id: string }; Returns: boolean }
      is_partner: { Args: { _user_id: string }; Returns: boolean }
      is_partner_in_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_veloxis_staff: { Args: { _user_id: string }; Returns: boolean }
      validate_status_transition: {
        Args: {
          p_current_status: Database["public"]["Enums"]["deal_status"]
          p_new_status: Database["public"]["Enums"]["deal_status"]
          p_user_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      validate_upload_token: {
        Args: { p_token: string }
        Returns: {
          company_name: string
          exporter_id: string
          is_valid: boolean
          token_id: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "originator"
        | "deal_manager"
        | "greystar_originator"
        | "exporter"
        | "super_admin"
        | "partner_admin"
        | "partner_staff"
      audit_action:
        | "deal_created"
        | "deal_submitted"
        | "document_uploaded"
        | "deal_moved_to_under_review"
        | "document_requested"
        | "deal_approved"
        | "deal_rejected"
        | "ipu_generated"
        | "ipu_sent"
        | "ipu_signed"
        | "ipu_expired"
        | "ipu_resent"
        | "funding_recorded"
        | "repayment_recorded"
        | "demurrage_updated"
        | "internal_note_added"
        | "deal_closed"
        | "deal_status_changed"
        | "pricing_recalculated"
        | "document_superseded"
        | "exporter_created"
        | "kyc_verified"
        | "kyc_rejected"
        | "upload_token_generated"
        | "exporter_document_uploaded"
        | "exporter_document_verified"
        | "onboarding_submitted"
        | "onboarding_approved"
        | "onboarding_rejected"
        | "deal_changes_requested"
        | "deal_resubmitted"
        | "deal_sent_to_veloxis"
        | "deal_rejected_by_partner"
        | "deal_rejected_by_veloxis"
        | "deal_funded"
        | "deal_overdue"
        | "deal_field_edited"
        | "deal_document_requested"
        | "deal_document_uploaded"
        | "payment_advice_submitted"
        | "ipu_verified"
        | "exporter_receipt_confirmed"
      buyer_credit_check_status: "pending" | "pass" | "refer" | "fail"
      change_request_status: "pending" | "resolved" | "cancelled"
      commodity_type:
        | "solid_minerals"
        | "scrap_metal"
        | "manufactured_goods"
        | "textiles"
      deal_document_type:
        | "commercial_invoice"
        | "bill_of_lading"
        | "other"
        | "ipu_signed"
        | "payment_advice"
        | "buyer_registration_doc"
        | "packing_list"
        | "insurance_certificate"
        | "nxp_form"
        | "export_licence"
      deal_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "docs_requested"
        | "ready_for_final_approval"
        | "rejection_pending_approval"
        | "approved"
        | "rejected"
        | "ipu_sent"
        | "ipu_expired"
        | "ipu_signed_awaiting_funding"
        | "funded_active"
        | "repayment_due"
        | "overdue"
        | "payment_received"
        | "closed_repaid"
        | "closed_partial"
        | "changes_requested"
        | "sent_to_veloxis"
        | "rejected_by_partner"
        | "rejected_by_veloxis"
        | "in_collections"
        | "pending_exporter_acceptance"
        | "declined_by_exporter"
      document_request_status:
        | "pending_upload"
        | "uploaded_pending_review"
        | "verified"
        | "rejected"
        | "cancelled"
      entity_type: "limited_company" | "plc" | "llp" | "incorporated_trustee"
      expiry_status:
        | "valid"
        | "expiring_soon_60"
        | "expiring_soon_30"
        | "expiring_soon_7"
        | "expired"
        | "no_expiry"
      exporter_document_type:
        | "cac_certificate"
        | "director_id"
        | "nepc_certificate"
        | "other"
        | "ubo_declaration_doc"
        | "source_of_funds_doc"
        | "bank_statements"
      invoice_currency: "GBP" | "USD" | "EUR" | "NGN"
      kyc_status:
        | "pending_documents"
        | "documents_uploaded"
        | "under_review"
        | "verified"
        | "kyc_document_expired"
        | "rejected"
      onboarding_status:
        | "invited"
        | "password_set"
        | "onboarding_in_progress"
        | "onboarding_submitted"
        | "onboarding_approved"
        | "onboarding_rejected"
      repayment_reconciliation_status: "exact" | "short_payment" | "overpayment"
      sanctions_screening_status: "pending_screening" | "clear" | "flagged"
      settlement_method_type: "dom_account" | "naira_account"
      subscription_tier: "pay_as_you_go" | "veloxis_pro"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "originator",
        "deal_manager",
        "greystar_originator",
        "exporter",
        "super_admin",
        "partner_admin",
        "partner_staff",
      ],
      audit_action: [
        "deal_created",
        "deal_submitted",
        "document_uploaded",
        "deal_moved_to_under_review",
        "document_requested",
        "deal_approved",
        "deal_rejected",
        "ipu_generated",
        "ipu_sent",
        "ipu_signed",
        "ipu_expired",
        "ipu_resent",
        "funding_recorded",
        "repayment_recorded",
        "demurrage_updated",
        "internal_note_added",
        "deal_closed",
        "deal_status_changed",
        "pricing_recalculated",
        "document_superseded",
        "exporter_created",
        "kyc_verified",
        "kyc_rejected",
        "upload_token_generated",
        "exporter_document_uploaded",
        "exporter_document_verified",
        "onboarding_submitted",
        "onboarding_approved",
        "onboarding_rejected",
        "deal_changes_requested",
        "deal_resubmitted",
        "deal_sent_to_veloxis",
        "deal_rejected_by_partner",
        "deal_rejected_by_veloxis",
        "deal_funded",
        "deal_overdue",
        "deal_field_edited",
        "deal_document_requested",
        "deal_document_uploaded",
        "payment_advice_submitted",
        "ipu_verified",
        "exporter_receipt_confirmed",
      ],
      buyer_credit_check_status: ["pending", "pass", "refer", "fail"],
      change_request_status: ["pending", "resolved", "cancelled"],
      commodity_type: [
        "solid_minerals",
        "scrap_metal",
        "manufactured_goods",
        "textiles",
      ],
      deal_document_type: [
        "commercial_invoice",
        "bill_of_lading",
        "other",
        "ipu_signed",
        "payment_advice",
        "buyer_registration_doc",
        "packing_list",
        "insurance_certificate",
        "nxp_form",
        "export_licence",
      ],
      deal_status: [
        "draft",
        "submitted",
        "under_review",
        "docs_requested",
        "ready_for_final_approval",
        "rejection_pending_approval",
        "approved",
        "rejected",
        "ipu_sent",
        "ipu_expired",
        "ipu_signed_awaiting_funding",
        "funded_active",
        "repayment_due",
        "overdue",
        "payment_received",
        "closed_repaid",
        "closed_partial",
        "changes_requested",
        "sent_to_veloxis",
        "rejected_by_partner",
        "rejected_by_veloxis",
        "in_collections",
        "pending_exporter_acceptance",
        "declined_by_exporter",
      ],
      document_request_status: [
        "pending_upload",
        "uploaded_pending_review",
        "verified",
        "rejected",
        "cancelled",
      ],
      entity_type: ["limited_company", "plc", "llp", "incorporated_trustee"],
      expiry_status: [
        "valid",
        "expiring_soon_60",
        "expiring_soon_30",
        "expiring_soon_7",
        "expired",
        "no_expiry",
      ],
      exporter_document_type: [
        "cac_certificate",
        "director_id",
        "nepc_certificate",
        "other",
        "ubo_declaration_doc",
        "source_of_funds_doc",
        "bank_statements",
      ],
      invoice_currency: ["GBP", "USD", "EUR", "NGN"],
      kyc_status: [
        "pending_documents",
        "documents_uploaded",
        "under_review",
        "verified",
        "kyc_document_expired",
        "rejected",
      ],
      onboarding_status: [
        "invited",
        "password_set",
        "onboarding_in_progress",
        "onboarding_submitted",
        "onboarding_approved",
        "onboarding_rejected",
      ],
      repayment_reconciliation_status: [
        "exact",
        "short_payment",
        "overpayment",
      ],
      sanctions_screening_status: ["pending_screening", "clear", "flagged"],
      settlement_method_type: ["dom_account", "naira_account"],
      subscription_tier: ["pay_as_you_go", "veloxis_pro"],
    },
  },
} as const
