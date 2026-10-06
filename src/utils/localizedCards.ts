import { BusinessSignal, WaitingOnMeItem } from '../types';
import { AppLanguage } from './localization';

export interface LocalizedSignalContent {
  title: string;
  whyItMatters: string;
  assessment?: string;
  contradictionSummary?: string;
  recommendedPathway?: string;
  financialExposureLabel?: string;
  entityName?: string;
}

export interface LocalizedWaitingOnMeContent {
  title: string;
  description: string;
  preparedBy?: string;
  subject?: string;
}

export const LOCALIZED_SITUATIONS: Partial<Record<AppLanguage, Record<string, LocalizedSignalContent>>> = {
  es: {
    'sit-acme': {
      title: 'Acme Corporation — Renovación en Riesgo Crítico',
      entityName: 'Acme Corporation',
      whyItMatters: 'La renovación del contrato anual vence en 23 días. Cuatro fuentes muestran un alto riesgo de cancelación debido a una escalada técnica no resuelta a pesar del optimismo en el CRM.',
      assessment: 'El riesgo se eleva principalmente porque el ticket de Zendesk (#9842) bloquea las negociaciones. La factura vencida INV-2931 es una táctica deliberada de retención.',
      contradictionSummary: 'La intención de cancelación enviada por Gmail contradice el estado en Salesforce marcado como "Negociación (80% de Probabilidad)".',
      recommendedPathway: 'Escalar el ticket a ingeniería Nivel 3, asignar a Sarah Lin y enviar respuesta ejecutiva de la CEO antes de cerrar los términos.',
      financialExposureLabel: 'Riesgo de exposición de $180K en renovación anual'
    },
    'sit-northstar': {
      title: 'Northstar Systems — Retraso en Cobro de Factura Vencida',
      entityName: 'Northstar Systems',
      whyItMatters: 'El cliente prometió la transferencia el viernes, pero no figuran fondos entrantes ni en Mercury ni en el libro mayor de QuickBooks.',
      assessment: 'Retraso típico de procesamiento de cuentas por pagar en lugar de deuda incobrable. Un recordatorio personalizado con enlace ACH acelerará la recaudación.',
      contradictionSummary: 'El mensaje de Slack del contralor ("Transferencia enviada el viernes") contradice el feed bancario y Stripe (0 cobros registrados).',
      recommendedPathway: 'Enviar aviso de conciliación financiera verificado con enlace de pago directo ACH.',
      financialExposureLabel: '$42,000 en saldo pendiente de cuentas por cobrar'
    },
    'sit-vertex': {
      title: 'Vertex Logistics — Escalada de SLA y Bloqueo de Ingeniería',
      entityName: 'Vertex Logistics',
      whyItMatters: 'La degradación de latencia en la API europea provocó tiempos de espera agotados en la sincronización de lotes durante 4 horas.',
      assessment: 'El PR #412 en GitHub ya corrigió el error y espera aprobación de DevOps. Requiere memorando de crédito SLA de $1,200.',
      recommendedPathway: 'Ejecutar fusión de emergencia del PR, verificar latencia en DataDog y emitir aprobación del bono compensatorio.',
      financialExposureLabel: '$65K ARR Cliente Corporativo Nivel 1'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — Exceso de Capacidad y Límite de Contrato',
      entityName: 'HyperScale AI',
      whyItMatters: 'El consumo de la API superó en +140% el nivel contratado. Excelente oportunidad para migrar al Plan Empresarial a Medida.',
      assessment: 'Cliente sumamente satisfecho con el rendimiento. Alta probabilidad de conversión si se ofrece propuesta escalonada.',
      recommendedPathway: 'Generar alerta automática de capacidad al CTO con propuesta precalculada de actualización.',
      financialExposureLabel: 'Oportunidad de expansión y ventas adicionales de $95K'
    }
  },
  fr: {
    'sit-acme': {
      title: 'Acme Corporation — Renouvellement à Risque Élevé',
      entityName: 'Acme Corporation',
      whyItMatters: 'Le renouvellement du contrat arrive à échéance dans 23 jours. Quatre sources multi-systèmes indiquent un risque élevé de désabonnement dû à une anomalie technique.',
      assessment: 'Le risque est principalement lié au ticket Zendesk (#9842) bloquant la négociation. La facture INV-2931 semble être une retenue délibérée.',
      contradictionSummary: "L'e-mail client exprimant l'intention de résilier contredit le statut Salesforce 'Négociation (80% de probabilité)'.",
      recommendedPathway: "Transférer l'incident à l'ingénieur en chef Niveau 3, assigner Sarah Lin et envoyer une réponse personnalisée de la direction.",
      financialExposureLabel: 'Exposition contractuelle annuelle potentielle de 180 000 $'
    },
    'sit-northstar': {
      title: 'Northstar Systems — Retard de Recouvrement Facture Échue',
      entityName: 'Northstar Systems',
      whyItMatters: 'Le client avait promis un virement vendredi, mais aucun encaissement correspondant ne figure dans le relevé bancaire ou QuickBooks.',
      assessment: 'Retard de traitement comptable probable plutôt que créance douteuse. Un rappel direct avec lien de règlement ACH accélérera le paiement.',
      contradictionSummary: "L'affirmation sur Slack du contrôleur ('Virement émis vendredi') contredit le relevé Mercury et Stripe (0 transaction).",
      recommendedPathway: 'Envoyer une relance avec lien ACH sécurisé et suspendre le compte si impayé lundi.',
      financialExposureLabel: 'Solde débiteur de 42 000 $ en souffrance'
    },
    'sit-vertex': {
      title: "Vertex Logistics — Dépassement de SLA & Incident d'Ingénierie",
      entityName: 'Vertex Logistics',
      whyItMatters: "La dégradation de l'API européenne a entraîné des échecs de synchronisation de commandes par lots durant 4 heures consécutives.",
      assessment: 'Le correctif PR #412 sur GitHub est prêt et attend la validation DevOps. Un avoir SLA de 1 200 $ est nécessaire pour apaiser le client.',
      recommendedPathway: "Forcer la fusion du PR d'urgence, vérifier la latence sur DataDog et valider la note de crédit.",
      financialExposureLabel: 'Client Entreprise Tier 1 (65K$ ARR)'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — Dépassement de Capacité et de Contrat',
      entityName: 'HyperScale AI',
      whyItMatters: "L'utilisation de l'API a bondi de +140% par rapport au forfait contracté. Opportunité d'extension vers un plan Entreprise sur mesure.",
      assessment: 'Client satisfait des performances. Très forte probabilité de conversion avec une offre de mise à niveau avantageuse.',
      recommendedPathway: 'Rédiger une alerte de capacité adressée au CTO avec avenant de contrat validable en un clic.',
      financialExposureLabel: "Opportunité de vente additionnelle estimée à 95 000 $"
    }
  },
  de: {
    'sit-acme': {
      title: 'Acme Corporation — Vertragsverlängerung Akut Gefährdet',
      entityName: 'Acme Corporation',
      whyItMatters: 'Die Vertragsverlängerung steht in 23 Tagen an. Vier Systemquellen melden akutes Abwanderungsrisiko infolge eines ungelösten technischen Störfalls.',
      assessment: 'Risiko primär durch blockierendes Zendesk-Ticket (#9842) verursacht. Die überfällige Rechnung INV-2931 dient offenbar als Druckmittel.',
      contradictionSummary: 'Kündigungsabsicht per E-Mail widerspricht Salesforce CRM-Status "Verhandlung (80% Wahrscheinlichkeit)".',
      recommendedPathway: 'Eskalation an Tier-3-Engineering, Benennung von Sarah Lin als Verantwortliche und CEO-Stellungnahme versenden.',
      financialExposureLabel: 'Gefährdetes Jahresvertragsvolumen in Höhe von $180.000'
    },
    'sit-northstar': {
      title: 'Northstar Systems — Zahlungsverzug bei Überfälliger Forderung',
      entityName: 'Northstar Systems',
      whyItMatters: 'Überweisung wurde für Freitag zugesagt, jedoch verzeichnen weder Mercury noch QuickBooks den Eingang der Mittel.',
      assessment: 'Vermutlich buchhalterische Verzögerung. Eine gezielte Zahlungserinnerung mit direktem ACH-Sofortzahlungslink beschleunigt den Eingang.',
      contradictionSummary: 'Slack-Zusage des Controllers steht im Widerspruch zum Live-Kontoauszug (0 Zahlungseingänge).',
      recommendedPathway: 'Versand einer geprüften Mahnung mit direktem Zahlungslink und Vermerk für Buchhaltungssperre.',
      financialExposureLabel: '$42.000 offener Debitorensaldo'
    },
    'sit-vertex': {
      title: 'Vertex Logistics — SLA-Verletzung & Blockierender Engineering-Fehler',
      entityName: 'Vertex Logistics',
      whyItMatters: 'Erhöhte API-Latenzen im Europa-Cluster verursachten vierstündige Batch-Synchronisationsabbrüche.',
      assessment: 'GitHub-PR #412 ist bereit und wartet auf DevOps-Genehmigung. SLA-Gutschrift über $1.200 erforderlich.',
      recommendedPathway: 'Notfall-Merge durchführen, Latenzabfall in DataDog prüfen und Gutschrift automatisch freigeben.',
      financialExposureLabel: '$65K ARR Tier-1 Enterprise-Kunde'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — Kapazitäts- und Kontingentüberschreitung',
      entityName: 'HyperScale AI',
      whyItMatters: 'API-Volumen liegt +140% über Vertragskontingent. Hohes Potenzial für Upgrade auf maßgeschneiderten Enterprise-Tarif.',
      assessment: 'Kunde schätzt die Zuverlässigkeit. Hohe Abschlussquote bei zeitnaher Vorlage eines Staffelrabatts.',
      recommendedPathway: 'Automatisierte Kapazitätswarnung mit Upgrade-Angebot per 1-Klick-Zustimmung an den CTO senden.',
      financialExposureLabel: '$95K Expansions- und Upsell-Potenzial'
    }
  },
  ja: {
    'sit-acme': {
      title: 'Acme Corporation — 年間契約更新の重大リスク',
      entityName: 'Acme Corporation',
      whyItMatters: '契約更新まで残り23日。CRM上の楽観的数値とは異なり、未解決の重要技術障害により解約の危機に瀕しています。',
      assessment: 'Zendeskチケット(#9842)の滞留が交渉を妨害中。未払請求書INV-2931は意図的な保留と判明。',
      contradictionSummary: '顧客メール記載の解約通告がSalesforceの「商談中・成約率80%」と決定的に矛盾。',
      recommendedPathway: 'Tier-3リードエンジニアへ緊急エスカレーションし、CEO名義での正式回答を送付。',
      financialExposureLabel: '年間契約更新リスク想定額 $180,000'
    },
    'sit-northstar': {
      title: 'Northstar Systems — 未収金回収の遅延発生',
      entityName: 'Northstar Systems',
      whyItMatters: '金曜送金との口頭確約にもかかわらず、銀行明細およびStripeに該当入金が確認できません。',
      assessment: '貸倒れではなく先方経理の承認遅延。即時決済リンク付きの確認連絡で回収が可能です。',
      contradictionSummary: 'Slackでの「送金完了」連絡が銀行の照会結果（入金0件）と矛盾。',
      recommendedPathway: 'セキュアなACHダイレクト決済リンクを添付した入金照合通知を発行。',
      financialExposureLabel: '売掛未収金残高 $42,000'
    },
    'sit-vertex': {
      title: 'Vertex Logistics — SLA超過とエンジニアリング障害',
      entityName: 'Vertex Logistics',
      whyItMatters: '欧州クラスタのAPI遅延により、4時間にわたり一括注文同期のタイムアウトが発生。',
      assessment: 'GitHub PR #412は作成済みでDevOps承認待ち。顧客維持のために$1,200のSLA補填が必要。',
      recommendedPathway: '緊急PRマージを特権実行し、DataDogでレイテンシ改善を確認した上でクレジットを発行。',
      financialExposureLabel: '年間 $65K ARR ティア1最重要エンタープライズ'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — API利用量上限超過・プラン拡大機会',
      entityName: 'HyperScale AI',
      whyItMatters: 'API利用量が契約枠の+140%に急増。月末リセット前にカスタム法人枠へアップセルする好機。',
      assessment: 'システム性能への満足度が高く、段階割引プランの提示により極めて高い成約率が見込めます。',
      recommendedPathway: 'CTO向けにワンクリック承認が可能な増強プラン覚書を自動ドラフト。',
      financialExposureLabel: '$95K の追加拡張アップセル機会'
    }
  },
  zh: {
    'sit-acme': {
      title: 'Acme Corporation — 重点客户年度续约流失风险',
      entityName: 'Acme Corporation',
      whyItMatters: '合同将于23天后到期。尽管CRM保持乐观，但四个跨系统数据源均显示因技术缺陷未解而面临严重流失危机。',
      assessment: 'Zendesk工单(#9842)阻塞是谈判核心症结。逾期账单INV-2931实为客户施压保留手段。',
      contradictionSummary: '客户通过Gmail明确表达取消意向，与Salesforce中标记的“谈判阶段(80%概率)”严重冲突。',
      recommendedPathway: '升级至三级主任工程师，指派销售副总裁对接，并以CEO名义发出正式致歉与解决时间表。',
      financialExposureLabel: '潜在年度续约风险敞口 $180,000'
    },
    'sit-northstar': {
      title: 'Northstar Systems — 逾期应收账款回款延迟',
      entityName: 'Northstar Systems',
      whyItMatters: '客户承诺上周五电汇打款，但Mercury银行账户及QuickBooks均未见对应入账记录。',
      assessment: '大概率属于客户财务例行付款周期延误。发送带即时ACH快捷付款链接的对账提醒可迅速完成清收。',
      contradictionSummary: '客户财务负责人Slack沟通称“已汇出”，但银行底册显示入账金额为0。',
      recommendedPathway: '发送附带直连安全ACH链接的官方对账函，如周一仍未结算则启动财务管控。',
      financialExposureLabel: '未结应收账款敞口 $42,000'
    },
    'sit-vertex': {
      title: 'Vertex Logistics — SLA履约超时与研发阻塞',
      entityName: 'Vertex Logistics',
      whyItMatters: '欧洲集群API严重延迟导致批量订单同步超时长达4小时。',
      assessment: 'GitHub PR #412已完成代码修复，正等待DevOps复核。需补发$1,200服务补偿备忘录。',
      recommendedPathway: '特许执行紧急代码合并，在DataDog监控延迟回落，并自动下发SLA赔付抵扣券。',
      financialExposureLabel: '顶级重点企业客户 ($65K ARR)'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — 算力调用与合同配额超量',
      entityName: 'HyperScale AI',
      whyItMatters: 'API调用量超出签约配额+140%。建议在月末账单重置前升级至定制企业版席位。',
      assessment: '客户对系统稳定性高度认可。提供阶梯式折扣将有极大概率签署扩容合同。',
      recommendedPathway: '向客户CTO推送容量预警，并附带一键确认签署的专属升级附录。',
      financialExposureLabel: '预计可达成 $95K 扩容增售金额'
    }
  },
  ar: {
    'sit-acme': {
      title: 'شركة Acme Corporation — تجديد العقد معرض لخطر حرج',
      entityName: 'Acme Corporation',
      whyItMatters: 'يستحق تجديد العقد خلال 23 يوماً. تشير أربعة مصادر إلى احتمال كبير لخسارة العميل نتيجة لعطل فني غير محلول.',
      assessment: 'تذكرة الدعم (#9842) تعيق إتمام التفاوض. الفاتورة غير المسددة INV-2931 هي إجراء احتجاز مقصود.',
      contradictionSummary: 'إيميل العميل الذي يهدد بالإلغاء يتعارض مع تقرير Salesforce الذي يسجل احتمال 80% للتجديد.',
      recommendedPathway: 'تصعيد التذكرة إلى كبير مهندسي المستوى الثالث، وتكليف نائب المبيعات، وإرسال رد مباشر من الرئيس التنفيذي.',
      financialExposureLabel: 'تعرض مالي محتمل في التجديد السنوي قدره 180,000 دولار'
    },
    'sit-northstar': {
      title: 'Northstar Systems — تأخير في تحصيل الفواتير المستحقة',
      entityName: 'Northstar Systems',
      whyItMatters: 'وعد العميل بتحويل المبلغ يوم الجمعة، ولكن لم تظهر أي حوالة واردة في سجلات البنك أو الحسابات.',
      assessment: 'يرجع التأخير إلى دورة معالجة الحسابات الدائنة للعميل. سيسرع إرسال إشعار مصحوب برابط دفع ACH فوري في التحصيل.',
      contradictionSummary: 'تأكيد العميل عبر Slack بأنه تم التحويل يتعارض مع رصيد البنك الفعلي (0 وارد).',
      recommendedPathway: 'إرسال تذكير تسوية مالية معتمد يتضمن رابط دفع إلكتروني فوري.',
      financialExposureLabel: 'رصيد مستحق التحصيل بقيمة 42,000 دولار'
    },
    'sit-vertex': {
      title: 'Vertex Logistics — تصعيد اتفاقية مستوى الخدمة وعائق هندسي',
      entityName: 'Vertex Logistics',
      whyItMatters: 'تسبب بطء استجابة واجهة API في مراكز البيانات الأوروبية في توقف مزامنة الشحنات لمدة 4 ساعات.',
      assessment: 'الإصلاح البرمجي PR #412 جاهز على GitHub وينتظر موافقة DevOps. الحساب يتطلب رصيد تعويضي قدره 1,200 دولار.',
      recommendedPathway: 'تنفيذ دمج طارئ للتحديث البرمجي، والتأكد من انخفاض التأخير في DataDog، والموافقة على التعويض.',
      financialExposureLabel: 'عميل مؤسسي فئة أولى بإيراد 65 ألف دولار سنوياً'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — تجاوز سعة الاستخدام وحصة العقد',
      entityName: 'HyperScale AI',
      whyItMatters: 'ارتفع استهلاك الـ API بنسبة +140% فوق الحصة المتفق عليها. فرصة مثالية للترقية إلى باقة الشركات المخصصة.',
      assessment: 'العميل راضٍ جداً عن الأداء. فرصة إتمام الصفقة مرتفعة عند تقديم خيار الترقية بخصم تدريجي.',
      recommendedPathway: 'إعداد تنبيه آلي بالسعة لرئيس التكنولوجيا مع مسودة ترقية تعتمد بنقرة واحدة.',
      financialExposureLabel: 'فرصة توسع ومبيعات إضافية بقيمة 95 ألف دولار'
    }
  },
  pt: {
    'sit-acme': {
      title: 'Acme Corporation — Renovação em Risco Crítico',
      entityName: 'Acme Corporation',
      whyItMatters: 'A renovação do contrato anual vence em 23 dias. Quatro fontes indicam risco severo de cancelamento por causa de uma falha técnica pendente.',
      assessment: 'O ticket do Zendesk (#9842) está travando a negociação comercial. A fatura INV-2931 está retida intencionalmente.',
      contradictionSummary: 'A intenção de cancelamento expressa por e-mail contradiz o status no Salesforce (Negociação com 80% de chance).',
      recommendedPathway: 'Escalar para liderança técnica Nível 3, acionar Sarah Lin e enviar posicionamento assinado pela CEO.',
      financialExposureLabel: 'Exposição de receita anual de US$ 180.000'
    },
    'sit-northstar': {
      title: 'Northstar Systems — Atraso no Recebimento de Cobrança',
      entityName: 'Northstar Systems',
      whyItMatters: 'O cliente prometeu transferência na sexta-feira, mas nenhum valor entrou no extrato bancário ou no QuickBooks.',
      assessment: 'Atraso de processamento do financeiro do cliente. Notificação com link de pagamento direto ACH acelerará o recebimento.',
      contradictionSummary: 'Mensagem do controller no Slack contradiz dados bancários reais (0 entradas).',
      recommendedPathway: 'Enviar notificação de conciliação bancária verificada com link de liquidação instantânea.',
      financialExposureLabel: 'Saldo pendente em contas a receber de US$ 42.000'
    },
    'sit-vertex': {
      title: 'Vertex Logistics — Violação de SLA & Bloqueio de Engenharia',
      entityName: 'Vertex Logistics',
      whyItMatters: 'Degradação da API nos servidores europeus causou falhas no sincronismo de pedidos por 4 horas.',
      assessment: 'Pull Request #412 no GitHub pronto para aprovação. Necessário emitir crédito compensatório de US$ 1.200.',
      recommendedPathway: 'Fazer merge de emergência do PR, validar estabilidade no DataDog e aprovar nota de crédito.',
      financialExposureLabel: 'Cliente Corporativo Tier 1 de US$ 65K ARR'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — Excesso de Consumo e Limite de Contrato',
      entityName: 'HyperScale AI',
      whyItMatters: 'Uso da API cresceu +140% acima do teto contratual. Grande chance de migrar para contrato Custom Enterprise.',
      assessment: 'Cliente plenamente satisfeito com a velocidade. Alta propensão a fechar aditivo com desconto por escala.',
      recommendedPathway: 'Enviar alerta de capacidade ao CTO com opção de upgrade por aprovação em 1 clique.',
      financialExposureLabel: 'Oportunidade de expansão e upsell de US$ 95.000'
    }
  },
  it: {
    'sit-acme': {
      title: 'Acme Corporation — Rinnovo Contrattuale ad Alto Rischio',
      entityName: 'Acme Corporation',
      whyItMatters: 'Il rinnovo scade tra 23 giorni. Quattro fonti aziendali confermano un elevato rischio di perdita del cliente a causa di un bug non risolto.',
      assessment: 'Il ticket Zendesk (#9842) blocca le trattative. La fattura non saldata INV-2931 rappresenta una trattenuta strategica del cliente.',
      contradictionSummary: 'La comunicazione mail di disdetta contraddice la previsione Salesforce (Trattativa all 80%).',
      recommendedPathway: 'Scalare al responsabile tecnico Tier-3, coinvolgere Sarah Lin e inviare lettera rassicurativa della CEO.',
      financialExposureLabel: 'Esposizione finanziaria stimata in $180.000'
    },
    'sit-northstar': {
      title: 'Northstar Systems — Ritardo nell Incasso di Fattura Scaduta',
      entityName: 'Northstar Systems',
      whyItMatters: 'Il cliente aveva promesso il bonifico venerdì, ma nessun accredito risulta su Mercury o QuickBooks.',
      assessment: 'Ritardo contabile ordinario. Un sollecito cordiale con link diretto ACH garantirà l incasso immediato.',
      contradictionSummary: 'Dichiarazione su Slack di bonifico effettuato smentita dai flussi bancari (0 incassi registrati).',
      recommendedPathway: 'Inviare sollecito di riconciliazione con link di pagamento digitale sicuro.',
      financialExposureLabel: 'Credito commerciale residuo di $42.000'
    },
    'sit-vertex': {
      title: 'Vertex Logistics — Violazione SLA e Blocco Tecnico',
      entityName: 'Vertex Logistics',
      whyItMatters: 'La latenza sui nodi europei ha causato interruzioni nel flusso ordini per oltre 4 ore.',
      assessment: 'La fix PR #412 su GitHub è pronta. Richiesta nota di credito di $1.200 per soddisfare il cliente.',
      recommendedPathway: 'Eseguire merge d urgenza, verificare su DataDog e confermare rimborso.',
      financialExposureLabel: 'Cliente Enterprise Tier 1 ($65K ARR)'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — Superamento Soglia e Volumi Contrattuali',
      entityName: 'HyperScale AI',
      whyItMatters: 'Chiamate API a +140% del limite concordato. Opportunità di upgrade alla formula Enterprise dedicata.',
      assessment: 'Cliente soddisfatto. Altissima probabilità di accettazione con piano scalare.',
      recommendedPathway: 'Inoltrare avviso al CTO con addendum contrattuale approvabile con un singolo clic.',
      financialExposureLabel: 'Opportunità di espansione contrattuale di $95.000'
    }
  },
  hi: {
    'sit-acme': {
      title: 'एक्मे कॉर्पोरेशन — नवीनीकरण गंभीर जोखिम में',
      entityName: 'Acme Corporation',
      whyItMatters: 'वार्षिक अनुबंध नवीनीकरण 23 दिनों में होना है। चार क्रॉस-सिस्टम स्रोत तकनीकी विफलता के कारण उच्च मंथन जोखिम दर्शाते हैं।',
      assessment: 'ज़ेंडैस्क टिकट (#9842) मुख्य अड़चन है। बकाया चालान INV-2931 जानबूझकर रोकी गई राशि प्रतीत होती है।',
      contradictionSummary: 'जीमेल में रद्दीकरण की चेतावनी सेल्सफोर्स में दर्शाई गई 80% संभावना से सीधे विरोधाभासी है।',
      recommendedPathway: 'टियर-3 इंजीनियरिंग टीम को मामला सौंपें, सारा लिन को नियुक्त करें और सीईओ द्वारा जवाब भेजें।',
      financialExposureLabel: '$180,000 वार्षिक अनुबंध नवीनीकरण जोखिम'
    },
    'sit-northstar': {
      title: 'नॉर्थस्टार सिस्टम्स — बकाया भुगतान वसूली में विलंब',
      entityName: 'Northstar Systems',
      whyItMatters: 'ग्राहक ने शुक्रवार को ट्रांसफर का वादा किया था, लेकिन बैंक खाते या क्विकबुक्स में कोई धनराशि नहीं आई है।',
      assessment: 'यह केवल लेखांकन प्रक्रिया में देरी है। तत्काल सुरक्षित भुगतान लिंक के साथ स्मरण पत्र वसूली में तेजी लाएगा।',
      contradictionSummary: 'स्लैक पर नियंत्रक का दावा कि राशि भेज दी गई है, बैंक रिकॉर्ड से मेल नहीं खाता (0 प्राप्ति)।',
      recommendedPathway: 'डायरेक्ट ACH भुगतान लिंक के साथ सत्यापित वित्तीय समाधान पत्र भेजें।',
      financialExposureLabel: '$42,000 की बकाया वसूली राशि'
    },
    'sit-vertex': {
      title: 'वर्टेक्स लॉजिस्टिक्स — एसएलए उल्लंघन और इंजीनियरिंग रुकावट',
      entityName: 'Vertex Logistics',
      whyItMatters: 'यूरोपीय क्लस्टर पर एपीआई विलंबता के कारण 4 घंटे तक बैच ऑर्डर सिंक विफल रहा।',
      assessment: 'गिटहब पीआर #412 तैयार है। खाते को शांत करने के लिए $1,200 एसएलए क्रेडिट आवश्यक है।',
      recommendedPathway: 'आपातकालीन पीआर मर्ज करें, डेटाडॉग में विलंबता सुधार सत्यापित करें और क्रेडिट जारी करें।',
      financialExposureLabel: '$65K ARR टियर-1 एंटरप्राइज ग्राहक'
    },
    'sit-hyperscale': {
      title: 'हाइपरस्केल एआई — क्षमता और अनुबंध सीमा का उल्लंघन',
      entityName: 'HyperScale AI',
      whyItMatters: 'एपीआई उपयोग अनुबंध सीमा से +140% बढ़ गया है। कस्टम एंटरप्राइज प्लान में अपग्रेड करने का शानदार अवसर।',
      assessment: 'ग्राहक प्रदर्शन से बहुत संतुष्ट है। टियर डिस्काउंट के साथ अपग्रेड प्रस्ताव स्वीकार होने की भारी संभावना।',
      recommendedPathway: 'सीटीओ को स्वचालित क्षमता चेतावनी और 1-क्लिक अनुबंध स्वीकृति पत्र भेजें।',
      financialExposureLabel: '$95K विस्तार और अपसेल का अवसर'
    }
  },
  ko: {
    'sit-acme': {
      title: 'Acme Corporation — 계약 갱신 심각한 이탈 위기',
      entityName: 'Acme Corporation',
      whyItMatters: '연간 계약 갱신이 23일 앞으로 다가왔습니다. CRM의 낙관적인 수치와 달리 미해결된 기술 장애로 이탈 위험이 매우 높습니다.',
      assessment: 'Zendesk 티켓(#9842)의 미해결이 협상을 가로막고 있습니다. 연체된 인보이스 INV-2931은 고의적인 지급 보류입니다.',
      contradictionSummary: '고객의 취소 통보 이메일이 Salesforce CRM의 "협상 진행 중(80% 성공 확률)" 상태와 정면 충돌합니다.',
      recommendedPathway: 'Tier-3 수석 엔지니어에게 긴급 이첩하고 Sarah Lin을 담당자로 지정하며 CEO 서한을 즉시 발송하십시오.',
      financialExposureLabel: '잠재적 연간 갱신 위험 노출액 $180,000'
    },
    'sit-northstar': {
      title: 'Northstar Systems — 미수금 회수 지연 발생',
      entityName: 'Northstar Systems',
      whyItMatters: '고객이 금요일 송금을 약속했으나 Mercury 은행 피드 및 QuickBooks 원장에 매칭되는 입금이 없습니다.',
      assessment: '부실채권이 아닌 재무팀 처리 지연입니다. 즉시 ACH 결제 링크가 포함된 맞춤형 확인서로 신속한 회수가 가능합니다.',
      contradictionSummary: '고객 재무담당자의 Slack 송금 확인 메시지가 은행 입금 내역(0건)과 불일치합니다.',
      recommendedPathway: '안전한 즉시 결제 ACH 링크가 포함된 재무 정산 통지서를 발송하십시오.',
      financialExposureLabel: '미수금 잔액 $42,000'
    },
    'sit-vertex': {
      title: 'Vertex Logistics — SLA 위반 및 엔지니어링 장애',
      entityName: 'Vertex Logistics',
      whyItMatters: '유럽 클러스터 API 지연으로 4시간 동안 대량 주문 동기화 타임아웃이 발생했습니다.',
      assessment: 'GitHub PR #412 수정안이 작성되어 DevOps 승인 대기 중입니다. $1,200의 SLA 크레딧 발행이 필요합니다.',
      recommendedPathway: '긴급 PR 머지를 실행하고 DataDog에서 지연 해소를 검증한 후 보상 크레딧을 발행하십시오.',
      financialExposureLabel: '$65K ARR 1등급 핵심 기업 고객'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — 계약 트래픽 초과 및 증설 기회',
      entityName: 'HyperScale AI',
      whyItMatters: 'API 사용량이 계약 용량을 +140% 초과했습니다. 월말 갱신 전 맞춤형 엔터프라이즈 티어로 업셀할 적기입니다.',
      assessment: '성능 만족도가 매우 높습니다. 단계별 할인 조건을 제시할 경우 전환 확률이 극히 높습니다.',
      recommendedPathway: 'CTO에게 1-클릭 승인이 가능한 용량 증설 제안서를 자동 발송하십시오.',
      financialExposureLabel: '$95K 규모의 확장 업셀 기회'
    }
  },
  ru: {
    'sit-acme': {
      title: 'Acme Corporation — Критический риск срыва продления',
      entityName: 'Acme Corporation',
      whyItMatters: 'Продление контракта через 23 дня. Четыре независимых источника фиксируют риск ухода клиента из-за технического сбоя.',
      assessment: 'Тикет Zendesk (#9842) блокирует переговоры. Просроченный счет INV-2931 является рычагом давления со стороны клиента.',
      contradictionSummary: 'Письмо клиента с угрозой отказа прямо противоречит оптимистичному статусу в Salesforce (80% вероятность).',
      recommendedPathway: 'Эскалировать тикет ведущему инженеру Tier-3, закрепить за Сарой Лин и отправить ответ за подписью CEO.',
      financialExposureLabel: 'Финансовый риск продления на сумму $180 000'
    },
    'sit-northstar': {
      title: 'Northstar Systems — Задержка инкассации просроченного счета',
      entityName: 'Northstar Systems',
      whyItMatters: 'Клиент обещал банковский перевод в пятницу, но входящих средств в Mercury и QuickBooks не обнаружено.',
      assessment: 'Обычная задержка бухгалтерии клиента. Персонализированное напоминание со ссылкой на ACH ускорит поступление.',
      contradictionSummary: 'Сообщение финансового директора в Slack о переводе противоречит банковской выписке (0 поступлений).',
      recommendedPathway: 'Отправить официальное сверхочное уведомление с прямой ссылкой на оплату.',
      financialExposureLabel: 'Дебиторская задолженность в размере $42 000'
    },
    'sit-vertex': {
      title: 'Vertex Logistics — Нарушение SLA и технический сбой',
      entityName: 'Vertex Logistics',
      whyItMatters: 'Задержка европейского API вызвала 4-часовой сбой синхронизации пакетных заказов.',
      assessment: 'Исправление PR #412 готово на GitHub и ждет одобрения DevOps. Требуется компенсационный кредит $1 200.',
      recommendedPathway: 'Применить экстренное слияние PR, проверить стабилизацию в DataDog и выпустить кредитную ноту.',
      financialExposureLabel: 'Ключевой корпоративный клиент ($65K ARR)'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — Превышение лимитов контракта',
      entityName: 'HyperScale AI',
      whyItMatters: 'Потребление API выросло на +140% сверх лимита. Возможность перевести клиента на кастомный Enterprise-тариф.',
      assessment: 'Клиент доволен качеством. Высокая вероятность заключения дополнительного соглашения со скидкой.',
      recommendedPathway: 'Подготовить автоматическое уведомление техническому директору с офертой в 1 клик.',
      financialExposureLabel: 'Потенциал допродажи на $95 000'
    }
  },
  nl: {
    'sit-acme': {
      title: 'Acme Corporation — Verlenging in Kritiek Gevaar',
      entityName: 'Acme Corporation',
      whyItMatters: 'Contractverlenging verloopt over 23 dagen. Vier cross-systeembronnen tonen een hoog churn-risico door een openstaande bug ondanks CRM-optimisme.',
      assessment: 'Zendesk-ticket (#9842) blokkeert de onderhandelingen. De vervallen factuur INV-2931 is een bewuste inhouding.',
      contradictionSummary: 'E-mail van klant over annulering spreekt Salesforce CRM-status "Onderhandeling (80% kans)" tegen.',
      recommendedPathway: 'Escaleer ticket naar Tier-3 engineering lead, wijs Sarah Lin aan en stuur direct antwoord namens de CEO.',
      financialExposureLabel: 'Potentieel contractrisico van $180.000 bij jaarlijkse verlenging'
    },
    'sit-northstar': {
      title: 'Northstar Systems — Vertraging bij Incasso Achterstallige Factuur',
      entityName: 'Northstar Systems',
      whyItMatters: 'Klant beloofde vrijdag een overboeking, maar er zijn geen bijschrijvingen gevonden in Mercury of QuickBooks.',
      assessment: 'Waarschijnlijk een administratieve verwerkingsvertraging. Een herinnering met directe ACH-betaallink versnelt inning.',
      contradictionSummary: 'Slack-bevestiging van controller ("Vrijdag overgemaakt") spreekt bankoverzicht tegen (0 ontvangsten).',
      recommendedPathway: 'Verstuur geverifieerde betalingsherinnering met directe betaallink.',
      financialExposureLabel: '$42.000 openstaand debiteurensaldo'
    },
    'sit-vertex': {
      title: 'Vertex Logistics — SLA-Overschrijding & Technische Blokkade',
      entityName: 'Vertex Logistics',
      whyItMatters: 'Hoge API-latentie op Europese clusters veroorzaakte 4 uur lang time-outs bij ordersynchronisaties.',
      assessment: 'Fix PR #412 op GitHub wacht op goedkeuring van DevOps. Account vereist een SLA-creditnota van $1.200.',
      recommendedPathway: 'Voer nood-merge uit, verifieer latentiedaling in DataDog en keur creditnota goed.',
      financialExposureLabel: '$65K ARR Tier-1 Enterprise Klant'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — Capaciteits- en Contractoverschrijding',
      entityName: 'HyperScale AI',
      whyItMatters: 'API-gebruik is met +140% gestegen boven de contractbundel. Uitstekende kans om te upgraden naar Enterprise op Maat.',
      assessment: 'Klant is zeer tevreden over prestaties. Hoge conversiekans bij aanbod met staffelkorting.',
      recommendedPathway: 'Stel geautomatiseerde capaciteitswaarschuwing op met 1-klik goedkeuring voor de CTO.',
      financialExposureLabel: '$95K uitbreidings- en upsell-kans'
    }
  },
  he: {
    'sit-acme': {
      title: 'תאגיד Acme — חידוש חוזה בסכנת נטישה קריטית',
      entityName: 'Acme Corporation',
      whyItMatters: 'חידוש החוזה השנתי יפוג בעוד 23 ימים. ארבעה מקורות מידע מצביעים על סיכון נטישה גבוה עקב תקלה טכנית לא פתורה, בניגוד לאופטימיות ב-CRM.',
      assessment: 'רמת הסיכון עלתה משמעותית עקב כרטיס תמיכה (#9842) החוסם את המו"מ. החשבונית הפתוחה INV-2931 מעוכבת בכוונה כטקטיקת לחץ.',
      contradictionSummary: 'כוונת הנטישה שהתקבלה ב-Gmail סותרת את הסטטוס ב-Salesforce המסומן כ-"מו"מ מתקדם (80% סגירה)".',
      recommendedPathway: 'הסלם את הטיפול למהנדס בכיר רמה 3, הקצה את שרה לין ושלח מכתב מנכ"ל ישיר טרם סגירת התנאים.',
      financialExposureLabel: 'חשיפה כספית של $180,000 בחידוש השנתי'
    },
    'sit-northstar': {
      title: 'מערכות Northstar — עיכוב בגביית חשבונית פתוחה',
      entityName: 'Northstar Systems',
      whyItMatters: 'הלקוח הבטיח העברה בנקאית ביום שישי, אך שום סכום לא נקלט בחשבון הבנק או בספר החשבונות של QuickBooks.',
      assessment: 'מדובר בעיכוב פרוצדורלי במחלקת הנהלת חשבונות ולא בחוב אבוד. הודעת בירור מותאמת אישית עם קישור ACH ישיר תזרז את הגבייה.',
      contradictionSummary: 'הודעת הסלאק של החשב ("ההעברה בוצעה ביום שישי") סותרת את נתוני הבנק (0 תקבולים רשומים).',
      recommendedPathway: 'שלח הודעת התאמה פיננסית מאומתת עם קישור לתשלום מידי.',
      financialExposureLabel: '$42,000 יתרת חוב פתוחה לגבייה'
    },
    'sit-vertex': {
      title: 'Vertex Logistics — חריגת SLA וחסימה הנדסית',
      entityName: 'Vertex Logistics',
      whyItMatters: 'שיהוי גבוה ב-API באשכול האירופי גרם לזמני תגובה חריגים וביטולי סנכרון הזמנות במשך 4 שעות.',
      assessment: 'תיקון PR #412 ב-GitHub ממתין לאישור DevOps. הלקוח זכאי לזיכוי SLA בסך $1,200.',
      recommendedPathway: 'בצע מיזוג חירום של ה-PR, ודא תיקון שיהוי ב-DataDog ואשר הנפקת תעודת זיכוי.',
      financialExposureLabel: '$65K ARR לקוח אנטרפרייז דרג 1'
    },
    'sit-hyperscale': {
      title: 'HyperScale AI — חריגת תעבורה ומכסת חוזה',
      entityName: 'HyperScale AI',
      whyItMatters: 'צריכת ה-API חרגה ב-+140% מעבר לחבילת החוזה. הזדמנות מעולה לשדרוג לחבילת אנטרפרייז מותאמת אישית.',
      assessment: 'הלקוח שבע רצון מביצועי המערכת. הסתברות גבוהה לסגירת שדרוג בתנאי הנחת כמות.',
      recommendedPathway: 'שלח התרעת קיבולת אוטומטית ל-CTO עם הצעת שדרוג מוכנה לאישור בקליק אחד.',
      financialExposureLabel: 'הזדמנות הרחבה ומכירה נוספת בסך $95,000'
    }
  }
};

export const LOCALIZED_WAITING_ON_ME: Partial<Record<AppLanguage, Record<string, LocalizedWaitingOnMeContent>>> = {
  es: {
    'wom-01': {
      title: 'Aprobar Respuesta Ejecutiva de Renovación a David Sterling (Acme)',
      description: 'SignalDesk preparó una respuesta personalizada de la CEO abordando el ticket #9842 y garantizando la estabilidad antes de firmar.',
      preparedBy: 'Agente de Ingresos (Aria Vance) para Borahma Sharai (CEO)',
      subject: 'Actualización sobre Ticket #9842 y Compromiso de Renovación'
    },
    'wom-02': {
      title: 'Autorizar Recordatorio de Conciliación de Factura Vencida por $42K (Northstar)',
      description: 'El Agente Financiero redactó un aviso cortés de verificación de transferencia con enlace directo de pago seguro ACH.',
      preparedBy: 'Agente de Finanzas (Marcus Sterling)',
      subject: 'Conciliación de Pago: Factura INV-3019 ($42,000.00)'
    },
    'wom-03': {
      title: 'Autorizar Despliegue de Emergencia del PR #412 al Clúster de Producción (Vertex)',
      description: 'El Agente de Operaciones solicita derivación soberana para implementar el parche de conexión a base de datos y restaurar el SLA.',
      preparedBy: 'Agente de Operaciones (Kavita Patel)',
      subject: 'Despliegue Urgente en Producción: PR #412'
    },
    'wom-04': {
      title: 'Aprobar Nota de Crédito por $1,200 por Compensación de SLA (Vertex Logistics)',
      description: 'El Agente de Soporte preparó un ajuste en el ciclo de facturación para compensar la demora de 4 horas y proteger la satisfacción.',
      preparedBy: 'Agente de Soporte (Maya Lin)',
      subject: 'Ajuste de Crédito por SLA: INV-4091 ($1,200.00)'
    }
  },
  fr: {
    'wom-01': {
      title: 'Approuver la Réponse Exécutive pour David Sterling (Acme Corp)',
      description: 'SignalDesk a rédigé une réponse de la direction traitant de la résolution du ticket #9842 et sécurisant le renouvellement.',
      preparedBy: 'Agent Revenu (Aria Vance) pour Borahma Sharai (CEO)',
      subject: 'Mise à jour sur l incident #9842 et Engagement de Renouvellement'
    },
    'wom-02': {
      title: 'Autoriser la Relance de Facture Échue de 42 000 $ (Northstar)',
      description: 'L Agent Financier a préparé un avis de vérification bancaire avec lien de paiement direct ACH sécurisé.',
      preparedBy: 'Agent Finances (Marcus Sterling)',
      subject: 'Rapprochement de Règlement : Facture INV-3019 (42 000,00 $)'
    },
    'wom-03': {
      title: 'Autoriser le Déploiement d Urgence du PR #412 en Production (Vertex)',
      description: 'L Agent Opérations demande une dérogation pour déployer le correctif de base de données et rétablir le SLA.',
      preparedBy: 'Agent Opérations (Kavita Patel)',
      subject: 'Déploiement d Urgence en Production : PR #412'
    },
    'wom-04': {
      title: 'Approuver l Avoir de 1 200 $ au Titre du SLA (Vertex Logistics)',
      description: 'L Agent Support a préparé une note de crédit compensatoire sur la prochaine facture pour préserver la satisfaction client.',
      preparedBy: 'Agent Support Client (Maya Lin)',
      subject: 'Avoir de Compensation SLA : INV-4091 (1 200,00 $)'
    }
  },
  de: {
    'wom-01': {
      title: 'Freigabe der CEO-Antwort an David Sterling (Acme Corp)',
      description: 'SignalDesk hat eine Vorstandsnachricht zur Behebung von Ticket #9842 und Sicherung des Vertragsabschlusses erstellt.',
      preparedBy: 'Revenue-Agent (Aria Vance) für Borahma Sharai (CEO)',
      subject: 'Update zum Störfall #9842 & Vertragsverlängerung'
    },
    'wom-02': {
      title: 'Freigabe der $42K Mahnung mit ACH-Zahlungslink (Northstar)',
      description: 'Finance-Agent erstellte eine Zahlungsabstimmungsnachricht mit direktem ACH-Sofortüberweisungslink.',
      preparedBy: 'Finanz-Agent (Marcus Sterling)',
      subject: 'Zahlungsabstimmung: Rechnung INV-3019 ($42.000,00)'
    },
    'wom-03': {
      title: 'Notfall-Freigabe für PR #412 Hotfix im Produktions-Cluster (Vertex)',
      description: 'Operations-Agent fordert Dual-Key-Bypass an, um Verbindungspool-Patch einzuspielen und SLA wiederherzustellen.',
      preparedBy: 'Operations-Agent (Kavita Patel)',
      subject: 'Notfall-Rollout Produktion: PR #412'
    },
    'wom-04': {
      title: 'Genehmigung von $1.200 SLA-Gutschrift für Vertex Logistics',
      description: 'Support-Agent hat Ausgleichsgutschrift vorbereitet, um die 4-stündige Verzögerung zu kompensieren.',
      preparedBy: 'Support-Agent (Maya Lin)',
      subject: 'SLA-Gutschrift: INV-4091 ($1.200,00)'
    }
  },
  ja: {
    'wom-01': {
      title: 'Acme社副社長宛て更新確約エグゼクティブ書簡の承認',
      description: '障害チケット#9842の修正進捗を報告し、契約継続を確固たるものにするためのCEO直筆文面を策定。',
      preparedBy: 'レベニューエージェント (Aria Vance) → Borahma Sharai (CEO)',
      subject: '障害チケット#9842の対応状況および契約更新について'
    },
    'wom-02': {
      title: 'Northstar社 $42K 未収金照合および即時決済リンク送付の承認',
      description: '金曜送金の照合番号確認およびワンクリックACH即時決済リンク付き公式書簡を作成。',
      preparedBy: '財務エージェント (Marcus Sterling)',
      subject: '入金照合のお願い：請求書 INV-3019 ($42,000.00)'
    },
    'wom-03': {
      title: '本番環境への緊急修正PR #412デプロイ承認（Vertex Logistics）',
      description: '欧州クラスタのDB接続枯渇を解消しSLAを回復するため、デュアルキー特権昇格デプロイを要請。',
      preparedBy: '運用エージェント (Kavita Patel)',
      subject: '本番環境緊急ロールアウト：PR #412'
    },
    'wom-04': {
      title: 'Vertex社向け $1,200 SLA補償クレジットメモの承認',
      description: '4時間の同期遅延に対する補償として、次回請求サイクルで充当するクレジットを発行。',
      preparedBy: 'サポートエージェント (Maya Lin)',
      subject: 'SLA補償クレジット調整：INV-4091 ($1,200.00)'
    }
  },
  zh: {
    'wom-01': {
      title: '审批发往 Acme 客户副总裁 David Sterling 的续约沟通函',
      description: 'SignalDesk 已拟定 CEO 专属回复，通报 #9842 工单修复进展并重申续约服务承诺。',
      preparedBy: '收入治理智能体 (Aria Vance) 呈交 Borahma Sharai (CEO)',
      subject: '关于工单 #9842 处理进展及续约合作事宜'
    },
    'wom-02': {
      title: '授权发往 Northstar Systems 的 $42K 逾期应收账款对账通知',
      description: '财务智能体已生成礼貌电汇核验函，附带 Stripe ACH 直连安全结算通道。',
      preparedBy: '财务治理智能体 (Marcus Sterling)',
      subject: '款项核对：发票编号 INV-3019 ($42,000.00)'
    },
    'wom-03': {
      title: '授权紧急 PR #412 补丁直推生产集群部署 (Vertex)',
      description: '运维智能体申请双重签名根特权，将数据库连接池修复推至欧洲集群恢复SLA。',
      preparedBy: '运维治理智能体 (Kavita Patel)',
      subject: '紧急生产发布部署：PR #412'
    },
    'wom-04': {
      title: '审批给予 Vertex Logistics 的 $1,200 SLA 服务补偿抵扣单',
      description: '客户支持智能体已为下个账单周期拟定服务补偿抵扣，对冲4小时批处理延迟。',
      preparedBy: '客户支持智能体 (Maya Lin)',
      subject: 'SLA服务抵扣调账：INV-4091 ($1,200.00)'
    }
  },
  ar: {
    'wom-01': {
      title: 'الموافقة على خطاب التجديد التنفيذي الموجه إلى David Sterling (شركة Acme)',
      description: 'أعد SignalDesk رداً تنفيذياً مخصصاً يوضح جدول حل المشكلة #9842 ويؤكد الالتزام بالتجديد.',
      preparedBy: 'وكيل الإيرادات (Aria Vance) نيابة عن Borahma Sharai (الرئيس التنفيذي)',
      subject: 'تحديث بشأن التذكرة #9842 والتزام التجديد'
    },
    'wom-02': {
      title: 'تفويض إشعار تسوية الفاتورة المتأخرة بقيمة 42 ألف دولار (Northstar)',
      description: 'صاغ الوكيل المالي إشعار تحقق لطيف مع رابط مباشر للدفع الفوري عبر ACH.',
      preparedBy: 'الوكيل المالي (Marcus Sterling)',
      subject: 'تسوية المدفوعات: فاتورة رقم INV-3019 ($42,000.00)'
    },
    'wom-03': {
      title: 'تفويض النشر الطارئ للتحديث PR #412 في بيئة الإنتاج (Vertex)',
      description: 'طلب وكيل العمليات تجاوزاً سيادياً ثنائياً لتطبيق إصلاح اتصال قاعدة البيانات واستعادة اتفاقية مستوى الخدمة.',
      preparedBy: 'وكيل العمليات (Kavita Patel)',
      subject: 'نشر طارئ للإنتاج: PR #412'
    },
    'wom-04': {
      title: 'الموافقة على خصم تعويضي بقيمة 1,200 دولار لاتفاقية SLA (Vertex Logistics)',
      description: 'أعد وكيل الدعم تعديلاً ائتمانياً في دورة الفوترة القادمة لتعويض تأخير الطلبات وحماية رضا العملاء.',
      preparedBy: 'وكيل خدمة العملاء (Maya Lin)',
      subject: 'تعديل ائتمان اتفاقية SLA: INV-4091 (1,200.00 دولار)'
    }
  },
  pt: {
    'wom-01': {
      title: 'Aprovar Resposta Executiva sobre Renovação para David Sterling (Acme)',
      description: 'SignalDesk preparou resposta executiva detalhando resolução do ticket #9842 para garantir a renovação.',
      preparedBy: 'Agente de Receita (Aria Vance) para Borahma Sharai (CEO)',
      subject: 'Atualização sobre o Ticket #9842 e Compromisso de Renovação'
    },
    'wom-02': {
      title: 'Autorizar Notificação de Cobrança de US$ 42K com Link ACH (Northstar)',
      description: 'Agente Financeiro redigiu aviso cordial de conciliação bancária com link de pagamento seguro.',
      preparedBy: 'Agente de Finanças (Marcus Sterling)',
      subject: 'Conciliação de Pagamento: Fatura INV-3019 (US$ 42.000,00)'
    },
    'wom-03': {
      title: 'Autorizar Deploy de Emergência do PR #412 no Cluster de Produção (Vertex)',
      description: 'Agente de Operações solicita bypass soberano para aplicar correção de pool de conexões e restaurar SLA.',
      preparedBy: 'Agente de Operações (Kavita Patel)',
      subject: 'Deploy Emergencial de Produção: PR #412'
    },
    'wom-04': {
      title: 'Aprovar Nota de Crédito de US$ 1.200 por Violação de SLA (Vertex Logistics)',
      description: 'Agente de Suporte preparou compensação na fatura para amortizar o atraso de 4 horas de sincronização.',
      preparedBy: 'Agente de Suporte (Maya Lin)',
      subject: 'Crédito Compensatório SLA: INV-4091 (US$ 1.200,00)'
    }
  },
  it: {
    'wom-01': {
      title: 'Approva Risposta Direzionale a David Sterling (Acme Corp)',
      description: 'SignalDesk ha preparato una comunicazione ufficiale sul ticket #9842 per confermare il rinnovo.',
      preparedBy: 'Agente Revenue (Aria Vance) per Borahma Sharai (CEO)',
      subject: 'Aggiornamento sul ticket #9842 e Rinnovo Contrattuale'
    },
    'wom-02': {
      title: 'Autorizza Sollecito Riconciliazione da $42K con Link ACH (Northstar)',
      description: 'L Agente Finanziario ha predisposto un sollecito bancario con link diretto di pagamento.',
      preparedBy: 'Agente Finanze (Marcus Sterling)',
      subject: 'Riconciliazione Pagamento: Fattura INV-3019 ($42.000,00)'
    },
    'wom-03': {
      title: 'Autorizza Rilascio di Emergenza della PR #412 in Produzione (Vertex)',
      description: 'Agente Operativo richiede bypass dual-key per distribuire la patch sul pool di connessioni DB.',
      preparedBy: 'Agente Operazioni (Kavita Patel)',
      subject: 'Rilascio di Emergenza Produzione: PR #412'
    },
    'wom-04': {
      title: 'Approva Nota di Credito SLA di $1.200 per Vertex Logistics',
      description: 'Agente Supporto ha preparato un rimborso di compensazione sul prossimo ciclo di fatturazione.',
      preparedBy: 'Agente Supporto (Maya Lin)',
      subject: 'Nota di Accredito SLA: INV-4091 ($1.200,00)'
    }
  },
  hi: {
    'wom-01': {
      title: 'डेविड स्टर्लिंग (एक्मे) को कार्यकारी नवीनीकरण पत्र स्वीकृत करें',
      description: 'SignalDesk ने टिकट #9842 के समाधान और नवीनीकरण प्रतिबद्धता की पुष्टि करते हुए सीईओ प्रतिक्रिया तैयार की है।',
      preparedBy: 'राजस्व एजेंट (एरिया वेंस) द्वारा एलेना रोस्तोवा (सीईओ) के लिए',
      subject: 'टिकट #9842 और नवीनीकरण प्रतिबद्धता पर अपडेट'
    },
    'wom-02': {
      title: 'नॉर्थस्टार $42K बकाया भुगतान समाधान नोटिस अधिकृत करें',
      description: 'वित्त एजेंट ने सीधे ACH भुगतान लिंक के साथ विनम्र बैंक सत्यापन सूचना तैयार की है।',
      preparedBy: 'वित्त एजेंट (मार्कस स्टर्लिंग)',
      subject: 'भुगतान समाधान: चालान INV-3019 ($42,000.00)'
    },
    'wom-03': {
      title: 'उत्पादन क्लस्टर में आपातकालीन पीआर #412 हॉटफिक्स परिनियोजन अधिकृत करें (वर्टेक्स)',
      description: 'संचालन एजेंट ने डीबी कनेक्शन पूल हॉटफिक्स को तैनात करने और एसएलए बहाल करने के लिए रूट बायपास का अनुरोध किया।',
      preparedBy: 'संचालन एजेंट (कविता पटेल)',
      subject: 'आपातकालीन उत्पादन रोलआउट: पीआर #412'
    },
    'wom-04': {
      title: 'वर्टेक्स लॉजिस्टिक्स के लिए $1,200 एसएलए क्रेडिट छूट स्वीकृत करें',
      description: 'ग्राहक सहायता एजेंट ने 4 घंटे के ऑर्डर विलंब की भरपाई के लिए आगामी बिलिंग चक्र पर क्रेडिट समायोजन तैयार किया।',
      preparedBy: 'ग्राहक सहायता एजेंट (माया लिन)',
      subject: 'एसएलए क्रेडिट समायोजन: INV-4091 ($1,200.00)'
    }
  },
  ko: {
    'wom-01': {
      title: 'David Sterling 부사장(Acme) 앞 갱신 확약 서한 승인',
      description: 'SignalDesk가 #9842 티켓 조치 일정 보고 및 갱신 확약을 위한 CEO 직속 회신문을 준비했습니다.',
      preparedBy: '수익 관리 에이전트 (Aria Vance) → Borahma Sharai (CEO)',
      subject: '웹훅 장애(#9842) 조치 경과 및 계약 갱신에 관한 건'
    },
    'wom-02': {
      title: 'Northstar $42K 연체 대금 정산 통지 및 ACH 결제 승인',
      description: '재무 에이전트가 송금 확인 요청 및 즉시 안전 결제 ACH 링크가 포함된 서한을 작성했습니다.',
      preparedBy: '재무 관리 에이전트 (Marcus Sterling)',
      subject: '대금 정산 안내: 인보이스 INV-3019 ($42,000.00)'
    },
    'wom-03': {
      title: '운영 클러스터 긴급 핫픽스 PR #412 프로덕션 배포 승인 (Vertex)',
      description: '운영 에이전트가 유럽 클러스터의 DB 풀 고갈 해결 및 SLA 정상화를 위해 루트 권한 배포를 요청했습니다.',
      preparedBy: '운영 관리 에이전트 (Kavita Patel)',
      subject: '긴급 운영 배포: PR #412'
    },
    'wom-04': {
      title: 'Vertex Logistics 앞 $1,200 SLA 보상 크레딧 발행 승인',
      description: '고객지원 에이전트가 4시간 동기화 지연을 보상하고 고객만족도를 유지하기 위해 청구서 크레딧을 책정했습니다.',
      preparedBy: '고객지원 관리 에이전트 (Maya Lin)',
      subject: 'SLA 크레딧 조정: INV-4091 ($1,200.00)'
    }
  },
  ru: {
    'wom-01': {
      title: 'Одобрить письмо Дэвиду Стерлингу (Acme Corp) по продлению',
      description: 'SignalDesk подготовил ответ CEO с графиком исправления тикета #9842 и гарантией стабильности сервиса.',
      preparedBy: 'Revenue Agent (Aria Vance) для Елены Ростовой (CEO)',
      subject: 'Статус инцидента #9842 и продление контракта'
    },
    'wom-02': {
      title: 'Авторизовать сверку задолженности на $42 000 (Northstar)',
      description: 'Финансовый агент составил вежливый запрос с прямой ссылкой на моментальную оплату ACH.',
      preparedBy: 'Финансовый агент (Marcus Sterling)',
      subject: 'Сверка взаиморасчетов: Счет INV-3019 ($42 000,00)'
    },
    'wom-03': {
      title: 'Авторизовать экстренный релиз PR #412 в продакшн (Vertex)',
      description: 'Операционный агент запросил двухфакторный рут-байпас для исправления пула подключений к БД и восстановления SLA.',
      preparedBy: 'Операционный агент (Кавита Патель)',
      subject: 'Экстренный релиз в продакшн: PR #412'
    },
    'wom-04': {
      title: 'Одобрить компенсационный кредит на $1 200 по SLA (Vertex Logistics)',
      description: 'Агент поддержки подготовил кредитную ноту для компенсации 4-часовой задержки заказов.',
      preparedBy: 'Агент поддержки (Майя Лин)',
      subject: 'Корректировка кредита по SLA: INV-4091 ($1 200,00)'
    }
  },
  nl: {
    'wom-01': {
      title: 'Goedkeuring Uitgaande CEO-Brief aan David Sterling (Acme)',
      description: 'SignalDesk heeft een reactie opgesteld waarin de oplossing voor ticket #9842 en de verlengingsvoorwaarden worden bevestigd.',
      preparedBy: 'Revenue Agent (Aria Vance) voor Borahma Sharai (CEO)',
      subject: 'Update over ticket #9842 en contractverlenging'
    },
    'wom-02': {
      title: 'Autorisatie Betalingsherinnering $42K met ACH-Link (Northstar)',
      description: 'Financieel agent stelde een verificatiebericht op met directe ACH-betaallink naar de controller.',
      preparedBy: 'Financieel Agent (Marcus Sterling)',
      subject: 'Betalingsafstemming: Factuur INV-3019 ($42.000,00)'
    },
    'wom-03': {
      title: 'Autorisatie Nood-Deploy PR #412 naar Productie-Cluster (Vertex)',
      description: 'Operations Agent verzoekt om dual-key bypass voor databasepool-patch om SLA te herstellen.',
      preparedBy: 'Operations Agent (Kavita Patel)',
      subject: 'Nood-Rollout Productie: PR #412'
    },
    'wom-04': {
      title: 'Goedkeuring $1.200 SLA-Creditnota voor Vertex Logistics',
      description: 'Support Agent heeft creditering voorbereid op eerstvolgende factuur om 4 uur vertraging te compenseren.',
      preparedBy: 'Support Agent (Maya Lin)',
      subject: 'SLA-Creditering: INV-4091 ($1.200,00)'
    }
  },
  he: {
    'wom-01': {
      title: 'אישור מכתב חידוש חוזה מנכ"ל ישיר לדייוויד סטרלינג (Acme)',
      description: 'SignalDesk הכין טיוטת תגובה אישית המאשרת את פתרון תקלה #9842 ומבטיחה תנאי יציבות SLA לקראת חתימה.',
      preparedBy: 'סוכן הכנסות (Aria Vance) עבור אלנה רוסטובה (מנכ"ל)',
      subject: 'עדכון סטטוס תקלה #9842 והתחייבות תנאי חידוש'
    },
    'wom-02': {
      title: 'אישור שליחת הודעת התאמה וקישור תשלום ACH על סך $42K (Northstar)',
      description: 'סוכן הכספים ניסח פנייה מנומסת לאימות ביצוע ההעברה עם קישור תשלום ישיר ומאובטח לחשב החברה.',
      preparedBy: 'סוכן כספים (Marcus Sterling)',
      subject: 'התאמת תשלום: חשבונית INV-3019 ($42,000.00)'
    },
    'wom-03': {
      title: 'אישור פריסת חירום לפרודקשן של PR #412 (Vertex Logistics)',
      description: 'סוכן תפעול מבקש מעקף סמכות מיוחד לצורך פריסת טלאי חיבורי מסד הנתונים באשכול אירופה והשבת ה-SLA לתקנו.',
      preparedBy: 'סוכנת תפעול (Kavita Patel)',
      subject: 'פריסת חירום לפרודקשן: PR #412'
    },
    'wom-04': {
      title: 'אישור זיכוי SLA בסך $1,200 עבור Vertex Logistics',
      description: 'סוכנת שירות לקוחות הכינה זיכוי במחזור החיוב הקרוב כפיצוי על עיכוב סנכרון של 4 שעות לשמירה על שביעות רצון.',
      preparedBy: 'סוכנת שירות (Maya Lin)',
      subject: 'התאמת זיכוי SLA: חשבונית INV-4091 ($1,200.00)'
    }
  }
};

/**
 * Returns the localized version of a BusinessSignal based on the active language.
 */
export function getLocalizedSituation(situation: BusinessSignal, lang: AppLanguage): BusinessSignal {
  if (!situation || lang === 'en') return situation;
  const localized = LOCALIZED_SITUATIONS[lang]?.[situation.id];
  if (!localized) return situation;

  return {
    ...situation,
    title: localized.title || situation.title,
    whyItMatters: localized.whyItMatters || situation.whyItMatters,
    entityName: localized.entityName || situation.entityName,
    assessment: localized.assessment || situation.assessment,
    contradictionSummary: localized.contradictionSummary || situation.contradictionSummary,
    recommendedPathway: localized.recommendedPathway || situation.recommendedPathway,
    financialExposureLabel: localized.financialExposureLabel || situation.financialExposureLabel
  };
}

/**
 * Returns the localized version of a WaitingOnMeItem based on the active language.
 */
export function getLocalizedWaitingOnMe(item: WaitingOnMeItem, lang: AppLanguage): WaitingOnMeItem {
  if (!item || lang === 'en') return item;
  const localized = LOCALIZED_WAITING_ON_ME[lang]?.[item.id];
  if (!localized) return item;

  return {
    ...item,
    title: localized.title || item.title,
    description: localized.description || item.description,
    impactDescription: localized.description || item.impactDescription,
    preparedBy: localized.preparedBy || item.preparedBy,
    payload: item.payload ? {
      ...item.payload,
      subject: localized.subject || item.payload.subject
    } : item.payload
  };
}
