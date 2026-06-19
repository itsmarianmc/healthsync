'use client';

import { useEffect } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';

interface NotesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function NotesModal({ isOpen, onClose }: NotesModalProps) {
    const sheet = useDraggableSheet({ onClose });

    useEffect(() => {
        if (isOpen) sheet.open();
        else if (sheet.stateRef.current !== 'closed') sheet.close();
    }, [isOpen]);

    return (
        <div className="app-overlay" id="notesOverlay" ref={sheet.overlayRef} onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}>
            <div className="modal" id="notesModal" ref={sheet.modalRef}>
                <div className="modal-handle-zone" id="notesHandleZone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-title">About &amp; Licenses</div>
                </div>
                <div className="modal-body" id="notesModalBody" style={{ paddingBottom: '1em' }}>
                    <div className="license-section">
                        <div className="license-section-title">
                            <i className="fas fa-file-contract"></i> About HealthSync & Data Sources
                        </div>
                        <div className="license-section-body">
                            <p><strong>Data Sourcing & Transparency</strong></p>
                            <p>HealthSync proudly utilizes the <strong>Open Food Facts API</strong> (openfoodfacts.org) to provide users with a comprehensive database of food products. Open Food Facts is a collaborative, community-driven project; as such, nutritional data is sourced globally and may be subject to variation based on regional labeling laws and community contributions.</p>
                            <br />
                            <p><strong>Accuracy & Verification</strong></p>
                            <p>While we strive to present the most current data available, the nutritional values displayed may not always be accurate, complete, or up-to-date. Factors such as manufacturer reformulations or data entry errors can result in discrepancies. <strong>Always verify critical nutritional information-especially allergen data-against the physical product packaging before consumption.</strong></p>
                            <br />
                            <p><strong>Calculations & Methodology</strong></p>
                            <p>Calorie goals and macronutrient targets within HealthSync are estimations derived from the <strong>Mifflin-St Jeor formula</strong>. This equation calculates your Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE) based on user-provided metrics including age, biological sex, weight, height, and activity level. </p>
                            <br />
                            <p><strong>Medical Disclaimer</strong></p>
                            <p>All information provided by this application is for informational and educational purposes only. HealthSync is not a medical device, and its suggestions do not constitute medical advice. Nutritional requirements are highly individual; therefore, you should <strong>consult a healthcare professional or a registered dietitian</strong> for personalized guidance, especially if you have underlying health conditions or specific dietary requirements.</p>
                        </div>
                    </div>
                    <div className="license-section">
                        <div className="license-section-title"><i className="fas fa-file-contract"></i> Open Food Facts</div>
                        <div className="license-section-body">
                            <p><strong>ODC Open Database License (ODbL)</strong></p>
                            <br />
                            <p>URL: <a href="https://opendatacommons.org/licenses/odbl/1.0/" target="_blank">https://opendatacommons.org/licenses/odbl/1.0/</a></p>
                            <p>Individual contents: Database Contents License. Contributor data: CC-BY-SA.</p>
                            <br />
                            <p><strong>Preamble</strong></p>
                            <p>The Open Database License (ODbL) is a license agreement intended to allow users to freely share, modify, and use this Database while maintaining this same freedom for others. Many databases are covered by copyright, and therefore this document licenses these rights. Some jurisdictions, mainly in the European Union, have specific rights that cover databases, and so the ODbL addresses these rights, too. Finally, the ODbL is also an agreement in contract for users of this Database to act in certain ways in return for accessing this Database.</p>
                            <p>Databases can contain a wide variety of types of content (images, audiovisual material, and sounds all in the same database, for example), and so the ODbL only governs the rights over the Database, and not the contents of the Database individually. Licensors should use the ODbL together with another license for the contents, if the contents have a single set of rights that uniformly covers all of the contents. If the contents have multiple sets of different rights, Licensors should describe what rights govern what contents together in the individual record or in some other way that clarifies what rights apply.</p>
                            <p>Sometimes the contents of a database, or the database itself, can be covered by other rights not addressed here (such as private contracts, trade mark over the name, or privacy rights / data protection rights over information in the contents), and so you are advised that you may have to consult other documents or clear other rights before doing activities not covered by this License.</p>
                            <p>------</p>
                            <p>The Licensor (as defined below)</p>
                            <p>and</p>
                            <p>You (as defined below)</p>
                            <p>agree as follows:</p>
                            <br />
                            <p><strong>1.0 Definitions of Capitalised Words</strong></p>
                            <p>&quot;Collective Database&quot; - Means this Database in unmodified form as part of a collection of independent databases in themselves that together are assembled into a collective whole. A work that constitutes a Collective Database will not be considered a Derivative Database.</p>
                            <p>&quot;Convey&quot; - As a verb, means Using the Database, a Derivative Database, or the Database as part of a Collective Database in any way that enables a Person to make or receive copies of the Database or a Derivative Database. Conveying does not include interaction with a user through a computer network, or creating and Using a Produced Work, where no transfer of a copy of the Database or a Derivative Database occurs. &quot;Contents&quot; - The contents of this Database, which includes the information, independent works, or other material collected into the Database. For example, the contents of the Database could be factual data or works such as images, audiovisual material, text, or sounds.</p>
                            <p>&quot;Database&quot; - A collection of material (the Contents) arranged in a systematic or methodical way and individually accessible by electronic or other means offered under the terms of this License.</p>
                            <p>&quot;Database Directive&quot; - Means Directive 96/9/EC of the European Parliament and of the Council of 11 March 1996 on the legal protection of databases, as amended or succeeded.</p>
                            <p>&quot;Database Right&quot; - Means rights resulting from the Chapter III (&quot;sui generis&quot;) rights in the Database Directive (as amended and as transposed by member states), which includes the Extraction and Re-utilisation of the whole or a Substantial part of the Contents, as well as any similar rights available in the relevant jurisdiction under Section 10.4.</p>
                            <p>&quot;Derivative Database&quot; - Means a database based upon the Database, and includes any translation, adaptation, arrangement, modification, or any other alteration of the Database or of a Substantial part of the Contents. This includes, but is not limited to, Extracting or Re-utilising the whole or a Substantial part of the Contents in a new Database.</p>
                            <p>&quot;Extraction&quot; - Means the permanent or temporary transfer of all or a Substantial part of the Contents to another medium by any means or in any form.</p>
                            <p>&quot;License&quot; - Means this license agreement and is both a license of rights such as copyright and Database Rights and an agreement in contract.</p>
                            <p>&quot;Licensor&quot; - Means the Person that offers the Database under the terms of this License.</p>
                            <p>&quot;Person&quot; - Means a natural or legal person or a body of persons corporate or incorporate.</p>
                            <p>&quot;Produced Work&quot; - a work (such as an image, audiovisual material, text, or sounds) resulting from using the whole or a Substantial part of the Contents (via a search or other query) from this Database, a Derivative Database, or this Database as part of a Collective Database.</p>
                            <p>&quot;Publicly&quot; - means to Persons other than You or under Your control by either more than 50% ownership or by the power to direct their activities (such as contracting with an independent consultant).</p>
                            <p>&quot;Re-utilisation&quot; - means any form of making available to the public all or a Substantial part of the Contents by the distribution of copies, by renting, by online or other forms of transmission.</p>
                            <p>&quot;Substantial&quot; - Means substantial in terms of quantity or quality or a combination of both. The repeated and systematic Extraction or Re-utilisation of insubstantial parts of the Contents may amount to the Extraction or Re-utilisation of a Substantial part of the Contents.</p>
                            <p>&quot;Use&quot; - As a verb, means doing any act that is restricted by copyright or Database Rights whether in the original medium or any other; and includes without limitation distributing, copying, publicly performing, publicly displaying, and preparing derivative works of the Database, as well as modifying the Database as may be technically necessary to use it in a different mode or format.</p>
                            <p>&quot;You&quot; - Means a Person exercising rights under this License who has not previously violated the terms of this License with respect to the Database, or who has received express permission from the Licensor to exercise rights under this License despite a previous violation.</p>
                            <p>Words in the singular include the plural and vice versa.</p>
                            <br />
                            <p><strong>2.0 What this License covers</strong></p>
                            <p>2.1. Legal effect of this document. This License is:</p>
                            <p>a. A license of applicable copyright and neighbouring rights;</p>
                            <p>b. A license of the Database Right; and</p>
                            <p>c. An agreement in contract between You and the Licensor.</p>
                            <p>2.2 Legal rights covered. This License covers the legal rights in the Database, including:</p>
                            <p>a. Copyright. Any copyright or neighbouring rights in the Database. The copyright licensed includes any individual elements of the Database, but does not cover the copyright over the Contents independent of this Database. See Section 2.4 for details. Copyright law varies between jurisdictions, but is likely to cover: the Database model or schema, which is the structure, arrangement, and organisation of the Database, and can also include the Database tables and table indexes; the data entry and output sheets; and the Field names of Contents stored in the Database;</p>
                            <p>b. Database Rights. Database Rights only extend to the Extraction and Re-utilisation of the whole or a Substantial part of the Contents. Database Rights can apply even when there is no copyright over the Database. Database Rights can also apply when the Contents are removed from the Database and are selected and arranged in a way that would not infringe any applicable copyright; and</p>
                            <p>c. Contract. This is an agreement between You and the Licensor for access to the Database. In return you agree to certain conditions of use on this access as outlined in this License.</p>
                            <p>2.3 Rights not covered.</p>
                            <p>a. This License does not apply to computer programs used in the making or operation of the Database;</p>
                            <p>b. This License does not cover any patents over the Contents or the Database; and</p>
                            <p>c. This License does not cover any trademarks associated with the Database.</p>
                            <p>2.4 Relationship to Contents in the Database. The individual items of the Contents contained in this Database may be covered by other rights, including copyright, patent, data protection, privacy, or personality rights, and this License does not cover any rights (other than Database Rights or in contract) in individual Contents contained in the Database. For example, if used on a Database of images (the Contents), this License would not apply to copyright over individual images, which could have their own separate licenses, or one single license covering all of the rights over the images.</p>
                            <br />
                            <p><strong>3.0 Rights granted</strong></p>
                            <p>3.1 Subject to the terms and conditions of this License, the Licensor grants to You a worldwide, royalty-free, non-exclusive, terminable (but only under Section 9) license to Use the Database for the duration of any applicable copyright and Database Rights. These rights explicitly include commercial use, and do not exclude any field of endeavour. To the extent possible in the relevant jurisdiction, these rights may be exercised in all media and formats whether now known or created in the future.</p>
                            <p>The rights granted cover, for example:</p>
                            <p>a. Extraction and Re-utilisation of the whole or a Substantial part of the Contents;</p>
                            <p>b. Creation of Derivative Databases;</p>
                            <p>c. Creation of Collective Databases;</p>
                            <p>d. Creation of temporary or permanent reproductions by any means and in any form, in whole or in part, including of any Derivative Databases or as a part of Collective Databases; and</p>
                            <p>e. Distribution, communication, display, lending, making available, or performance to the public by any means and in any form, in whole or in part, including of any Derivative Database or as a part of Collective Databases.</p>
                            <p>3.2 Compulsory license schemes. For the avoidance of doubt:</p>
                            <p>a. Non-waivable compulsory license schemes. In those jurisdictions in which the right to collect royalties through any statutory or compulsory licensing scheme cannot be waived, the Licensor reserves the exclusive right to collect such royalties for any exercise by You of the rights granted under this License;</p>
                            <p>b. Waivable compulsory license schemes. In those jurisdictions in which the right to collect royalties through any statutory or compulsory licensing scheme can be waived, the Licensor waives the exclusive right to collect such royalties for any exercise by You of the rights granted under this License; and,</p>
                            <p>c. Voluntary license schemes. The Licensor waives the right to collect royalties, whether individually or, in the event that the Licensor is a member of a collecting society that administers voluntary licensing schemes, via that society, from any exercise by You of the rights granted under this License.</p>
                            <p>3.3 The right to release the Database under different terms, or to stop distributing or making available the Database, is reserved. Note that this Database may be multiple-licensed, and so You may have the choice of using alternative licenses for this Database. Subject to Section 10.4, all other rights not expressly granted by Licensor are reserved.</p>
                            <br />
                            <p><strong>4.0 Conditions of Use</strong></p>
                            <p>4.1 The rights granted in Section 3 above are expressly made subject to Your complying with the following conditions of use. These are important conditions of this License, and if You fail to follow them, You will be in material breach of its terms.</p>
                            <p>4.2 Notices. If You Publicly Convey this Database, any Derivative Database, or the Database as part of a Collective Database, then You must:</p>
                            <p>a. Do so only under the terms of this License or another license permitted under Section 4.4;</p>
                            <p>b. Include a copy of this License (or, as applicable, a license permitted under Section 4.4) or its Uniform Resource Identifier (URI) with the Database or Derivative Database, including both in the Database or Derivative Database and in any relevant documentation; and</p>
                            <p>c. Keep intact any copyright or Database Right notices and notices that refer to this License.</p>
                            <p>d. If it is not possible to put the required notices in a particular file due to its structure, then You must include the notices in a location (such as a relevant directory) where users would be likely to look for it.</p>
                            <p>4.3 Notice for using output (Contents). Creating and Using a Produced Work does not require the notice in Section 4.2. However, if you Publicly Use a Produced Work, You must include a notice associated with the Produced Work reasonably calculated to make any Person that uses, views, accesses, interacts with, or is otherwise exposed to the Produced Work aware that Content was obtained from the Database, Derivative Database, or the Database as part of a Collective Database, and that it is available under this License.</p>
                            <p>a. Example notice. The following text will satisfy notice under Section 4.3:</p>
                            <p>Contains information from DATABASE NAME, which is made available here under the Open Database License (ODbL).</p>
                            <p>DATABASE NAME should be replaced with the name of the Database and a hyperlink to the URI of the Database. &quot;Open Database License&quot; should contain a hyperlink to the URI of the text of this License. If hyperlinks are not possible, You should include the plain text of the required URI&apos;s with the above notice.</p>
                            <p>4.4 Share alike.</p>
                            <p>a. Any Derivative Database that You Publicly Use must be only under the terms of:</p>
                            <p>i. This License;</p>
                            <p>ii. A later version of this License similar in spirit to this License; or</p>
                            <p>iii. A compatible license.</p>
                            <p>If You license the Derivative Database under one of the licenses mentioned in (iii), You must comply with the terms of that license.</p>
                            <p>b. For the avoidance of doubt, Extraction or Re-utilisation of the whole or a Substantial part of the Contents into a new database is a Derivative Database and must comply with Section 4.4.</p>
                            <p>c. Derivative Databases and Produced Works. A Derivative Database is Publicly Used and so must comply with Section 4.4. if a Produced Work created from the Derivative Database is Publicly Used.</p>
                            <p>d. Share Alike and additional Contents. For the avoidance of doubt, You must not add Contents to Derivative Databases under Section 4.4 a that are incompatible with the rights granted under this License.</p>
                            <p>e. Compatible licenses. Licensors may authorise a proxy to determine compatible licenses under Section 4.4 a iii. If they do so, the authorised proxy&apos;s public statement of acceptance of a compatible license grants You permission to use the compatible license.</p>
                            <p>4.5 Limits of Share Alike. The requirements of Section 4.4 do not apply in the following:</p>
                            <p>a. For the avoidance of doubt, You are not required to license Collective Databases under this License if You incorporate this Database or a Derivative Database in the collection, but this License still applies to this Database or a Derivative Database as a part of the Collective Database;</p>
                            <p>b. Using this Database, a Derivative Database, or this Database as part of a Collective Database to create a Produced Work does not create a Derivative Database for purposes of Section 4.4; and</p>
                            <p>c. Use of a Derivative Database internally within an organisation is not to the public and therefore does not fall under the requirements of Section 4.4.</p>
                            <p>4.6 Access to Derivative Databases. If You Publicly Use a Derivative Database or a Produced Work from a Derivative Database, You must also offer to recipients of the Derivative Database or Produced Work a copy in a machine readable form of:</p>
                            <p>a. The entire Derivative Database; or</p>
                            <p>b. A file containing all of the alterations made to the Database or the method of making the alterations to the Database (such as an algorithm), including any additional Contents, that make up all the differences between the Database and the Derivative Database.</p>
                            <p>The Derivative Database (under a.) or alteration file (under b.) must be available at no more than a reasonable production cost for physical distributions and free of charge if distributed over the internet.</p>
                            <p>4.7 Technological measures and additional terms</p>
                            <p>a. This License does not allow You to impose (except subject to Section 4.7 b.) any terms or any technological measures on the Database, a Derivative Database, or the whole or a Substantial part of the Contents that alter or restrict the terms of this License, or any rights granted under it, or have the effect or intent of restricting the ability of any person to exercise those rights.</p>
                            <p>b. Parallel distribution. You may impose terms or technological measures on the Database, a Derivative Database, or the whole or a Substantial part of the Contents (a &quot;Restricted Database&quot;) in contravention of Section 4.74 a. only if You also make a copy of the Database or a Derivative Database available to the recipient of the Restricted Database:</p>
                            <p>i. That is available without additional fee;</p>
                            <p>ii. That is available in a medium that does not alter or restrict the terms of this License, or any rights granted under it, or have the effect or intent of restricting the ability of any person to exercise those rights (an &quot;Unrestricted Database&quot;); and</p>
                            <p>iii. The Unrestricted Database is at least as accessible to the recipient as a practical matter as the Restricted Database.</p>
                            <p>c. For the avoidance of doubt, You may place this Database or a Derivative Database in an authenticated environment, behind a password, or within a similar access control scheme provided that You do not alter or restrict the terms of this License or any rights granted under it or have the effect or intent of restricting the ability of any person to exercise those rights.</p>
                            <p>4.8 Licensing of others. You may not sublicense the Database. Each time You communicate the Database, the whole or Substantial part of the Contents, or any Derivative Database to anyone else in any way, the Licensor offers to the recipient a license to the Database on the same terms and conditions as this License. You are not responsible for enforcing compliance by third parties with this License, but You may enforce any rights that You have over a Derivative Database. You are solely responsible for any modifications of a Derivative Database made by You or another Person at Your direction. You may not impose any further restrictions on the exercise of the rights granted or affirmed under this License.</p>
                            <br />
                            <p><strong>5.0 Moral rights</strong></p>
                            <p>5.1 Moral rights. This section covers moral rights, including any rights to be identified as the author of the Database or to object to treatment that would otherwise prejudice the author&apos;s honour and reputation, or any other derogatory treatment:</p>
                            <p>a. For jurisdictions allowing waiver of moral rights, Licensor waives all moral rights that Licensor may have in the Database to the fullest extent possible by the law of the relevant jurisdiction under Section 10.4;</p>
                            <p>b. If waiver of moral rights under Section 5.1 a in the relevant jurisdiction is not possible, Licensor agrees not to assert any moral rights over the Database and waives all claims in moral rights to the fullest extent possible by the law of the relevant jurisdiction under Section 10.4; and</p>
                            <p>c. For jurisdictions not allowing waiver or an agreement not to assert moral rights under Section 5.1 a and b, the author may retain their moral rights over certain aspects of the Database.</p>
                            <p>Please note that some jurisdictions do not allow for the waiver of moral rights, and so moral rights may still subsist over the Database in some jurisdictions.</p>
                            <br />
                            <p><strong>6.0 Fair dealing, Database exceptions, and other rights not affected</strong></p>
                            <p>6.1 This License does not affect any rights that You or anyone else may independently have under any applicable law to make any use of this Database, including without limitation:</p>
                            <p>a. Exceptions to the Database Right including: Extraction of Contents from non-electronic Databases for private purposes, Extraction for purposes of illustration for teaching or scientific research, and Extraction or Re-utilisation for public security or an administrative or judicial procedure.</p>
                            <p>b. Fair dealing, fair use, or any other legally recognised limitation or exception to infringement of copyright or other applicable laws.</p>
                            <p>6.2 This License does not affect any rights of lawful users to Extract and Re-utilise insubstantial parts of the Contents, evaluated quantitatively or qualitatively, for any purposes whatsoever, including creating a Derivative Database (subject to other rights over the Contents, see Section 2.4). The repeated and systematic Extraction or Re-utilisation of insubstantial parts of the Contents may however amount to the Extraction or Re-utilisation of a Substantial part of the Contents.</p>
                            <br />
                            <p><strong>7.0 Warranties and Disclaimer</strong></p>
                            <p>7.1 The Database is licensed by the Licensor &quot;as is&quot; and without any warranty of any kind, either express, implied, or arising by statute, custom, course of dealing, or trade usage. Licensor specifically disclaims any and all implied warranties or conditions of title, non-infringement, accuracy or completeness, the presence or absence of errors, fitness for a particular purpose, merchantability, or otherwise. Some jurisdictions do not allow the exclusion of implied warranties, so this exclusion may not apply to You.</p>
                            <br />
                            <p><strong>8.0 Limitation of liability</strong></p>
                            <p>8.1 Subject to any liability that may not be excluded or limited by law, the Licensor is not liable for, and expressly excludes, all liability for loss or damage however and whenever caused to anyone by any use under this License, whether by You or by anyone else, and whether caused by any fault on the part of the Licensor or not. This exclusion of liability includes, but is not limited to, any special, incidental, consequential, punitive, or exemplary damages such as loss of revenue, data, anticipated profits, and lost business. This exclusion applies even if the Licensor has been advised of the possibility of such damages.</p>
                            <p>8.2 If liability may not be excluded by law, it is limited to actual and direct financial loss to the extent it is caused by proved negligence on the part of the Licensor.</p>
                            <br />
                            <p><strong>9.0 Termination of Your rights under this License</strong></p>
                            <p>9.1 Any breach by You of the terms and conditions of this License automatically terminates this License with immediate effect and without notice to You. For the avoidance of doubt, Persons who have received the Database, the whole or a Substantial part of the Contents, Derivative Databases, or the Database as part of a Collective Database from You under this License will not have their licenses terminated provided their use is in full compliance with this License or a license granted under Section 4.8 of this License. Sections 1, 2, 7, 8, 9 and 10 will survive any termination of this License.</p>
                            <p>9.2 If You are not in breach of the terms of this License, the Licensor will not terminate Your rights under it.</p>
                            <p>9.3 Unless terminated under Section 9.1, this License is granted to You for the duration of applicable rights in the Database.</p>
                            <p>9.4 Reinstatement of rights. If you cease any breach of the terms and conditions of this License, then your full rights under this License will be reinstated:</p>
                            <p>a. Provisionally and subject to permanent termination until the 60th day after cessation of breach;</p>
                            <p>b. Permanently on the 60th day after cessation of breach unless otherwise reasonably notified by the Licensor; or</p>
                            <p>c. Permanently if reasonably notified by the Licensor of the violation, this is the first time You have received notice of violation of this License from the Licensor, and You cure the violation prior to 30 days after your receipt of the notice.</p>
                            <p>Persons subject to permanent termination of rights are not eligible to be a recipient and receive a license under Section 4.8.</p>
                            <p>9.5 Notwithstanding the above, Licensor reserves the right to release the Database under different license terms or to stop distributing or making available the Database. Releasing the Database under different license terms or stopping the distribution of the Database will not withdraw this License (or any other license that has been, or is required to be, granted under the terms of this License), and this License will continue in full force and effect unless terminated as stated above.</p>
                            <br />
                            <p><strong>10.0 General</strong></p>
                            <p>10.1 If any provision of this License is held to be invalid or unenforceable, that must not affect the validity or enforceability of the remainder of the terms and conditions of this License and each remaining provision of this License shall be valid and enforced to the fullest extent permitted by law.</p>
                            <p>10.2 This License is the entire agreement between the parties with respect to the rights granted here over the Database. It replaces any earlier understandings, agreements or representations with respect to the Database.</p>
                            <p>10.3 If You are in breach of the terms of this License, You will not be entitled to rely on the terms of this License or to complain of any breach by the Licensor.</p>
                            <p>10.4 Choice of law. This License takes effect in and will be governed by the laws of the relevant jurisdiction in which the License terms are sought to be enforced. If the standard suite of rights granted under applicable copyright law and Database Rights in the relevant jurisdiction includes additional rights not granted under this License, these additional rights are granted in this License in order to meet the terms of this License.</p>
                        </div>
                    </div>
                    <div className="license-section">
                        <div className="license-section-title">
                            <i className="fas fa-file-contract"></i>
                            Font Awesome
                        </div>
                        <div className="license-section-body">
                            <p><strong>Font License</strong></p>
                            <p>Applies to all desktop and webfont files in the following directory: font-awesome/fonts/.</p>
                            <br />
                            <p><strong>License: SIL OFL 1.1</strong></p>
                            <p>URL: <a href="https://openfontlicense.org/" target="_blank">https://openfontlicense.org/</a></p>
                            <br />
                            <p><strong>Code License</strong></p>
                            <p>Applies to all CSS and LESS files in the following directories: font-awesome/css/, font-awesome/less/, and font-awesome/scss/.</p>
                            <p>License: MIT License</p>
                            <p>URL: <a href="https://opensource.org/license/mit" target="_blank">https://opensource.org/license/mit</a></p>
                            <br />
                            <p><strong>Documentation License</strong></p>
                            <p>Applies to all Font Awesome project files that are not a part of the Font or Code licenses.</p>
                            <p>License: CC BY 3.0</p>
                            <p>URL: <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank">https://creativecommons.org/licenses/by/3.0/</a></p>
                            <br />
                            <p><strong>Brand Icons</strong></p>
                            <p>All brand icons are trademarks of their respective owners.</p>
                            <p>The use of these trademarks does not indicate endorsement of the trademark holder by Font Awesome, nor vice versa.</p>
                            <p>Brand icons should only be used to represent the company or product to which they refer.</p>
                            <p>Please do not use brand logos for any purpose except to represent that particular brand or service.</p>
                        </div>
                    </div>
                    <div className="license-section">
                        <div className="license-section-title">
                            <i className="fas fa-file-contract"></i>
                            Supabase
                        </div>
                        <div className="license-section-body">
                            <p>Apache License<br />Version 2.0, January 2004<br /><a href="https://creativecommons.org/licenses/by/3.0/" target="_blank">https://creativecommons.org/licenses/by/3.0/</a></p>
                            <br />
                            <p>TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION</p>
                            <br />
                            <p>1. Definitions.</p>
                            <p>&quot;License&quot; shall mean the terms and conditions for use, reproduction, and distribution as defined by Sections 1 through 9 of this document.</p>
                            <p>&quot;Licensor&quot; shall mean the copyright owner or entity authorized by the copyright owner that is granting the License.</p>
                            <p>&quot;Legal Entity&quot; shall mean the union of the acting entity and all other entities that control, are controlled by, or are under common control with that entity. For the purposes of this definition, &quot;control&quot; means (i) the power, direct or indirect, to cause the direction or management of such entity, whether by contract or otherwise, or (ii) ownership of fifty percent (50%) or more of the outstanding shares, or (iii) beneficial ownership of such entity.</p>
                            <p>&quot;You&quot; (or &quot;Your&quot;) shall mean an individual or Legal Entity exercising permissions granted by this License.</p>
                            <p>&quot;Source&quot; form shall mean the preferred form for making modifications, including but not limited to software source code, documentation source, and configuration files.</p>
                            <p>&quot;Object&quot; form shall mean any form resulting from mechanical transformation or translation of a Source form, including but not limited to compiled object code, generated documentation, and conversions to other media types.</p>
                            <p>&quot;Work&quot; shall mean the work of authorship, whether in Source or Object form, made available under the License, as indicated by a copyright notice that is included in or attached to the work (an example is provided in the Appendix below).</p>
                            <p>&quot;Derivative Works&quot; shall mean any work, whether in Source or Object form, that is based on (or derived from) the Work and for which the editorial revisions, annotations, elaborations, or other modifications represent, as a whole, an original work of authorship. For the purposes of this License, Derivative Works shall not include works that remain separable from, or merely link (or bind by name) to the interfaces of, the Work and Derivative Works thereof.</p>
                            <p>&quot;Contribution&quot; shall mean any work of authorship, including the original version of the Work and any modifications or additions to that Work or Derivative Works thereof, that is intentionally submitted to Licensor for inclusion in the Work by the copyright owner or by an individual or Legal Entity authorized to submit on behalf of the copyright owner. For the purposes of this definition, &quot;submitted&quot; means any form of electronic, verbal, or written communication sent to the Licensor or its representatives, including but not limited to communication on electronic mailing lists, source code control systems, and issue tracking systems that are managed by, or on behalf of, the Licensor for the purpose of discussing and improving the Work, but excluding communication that is conspicuously marked or otherwise designated in writing by the copyright owner as &quot;Not a Contribution.&quot;</p>
                            <p>&quot;Contributor&quot; shall mean Licensor and any individual or Legal Entity on behalf of whom a Contribution has been received by Licensor and subsequently incorporated within the Work.</p>
                            <br />
                            <p>2. Grant of Copyright License. Subject to the terms and conditions of this License, each Contributor hereby grants to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare Derivative Works of, publicly display, publicly perform, sublicense, and distribute the Work and such Derivative Works in Source or Object form.</p>
                            <br />
                            <p>3. Grant of Patent License. Subject to the terms and conditions of this License, each Contributor hereby grants to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable (except as stated in this section) patent license to make, have made, use, offer to sell, sell, import, and otherwise transfer the Work, where such license applies only to those patent claims licensable by such Contributor that are necessarily infringed by their Contribution(s) alone or by combination of their Contribution(s) with the Work to which such Contribution(s) was submitted. If You institute patent litigation against any entity (including a cross-claim or counterclaim in a lawsuit) alleging that the Work or a Contribution incorporated within the Work constitutes direct or contributory patent infringement, then any patent licenses granted to You under this License for that Work shall terminate as of the date such litigation is filed.</p>
                            <br />
                            <p>4. Redistribution. You may reproduce and distribute copies of the Work or Derivative Works thereof in any medium, with or without modifications, and in Source or Object form, provided that You meet the following conditions:</p>
                            <p>(a) You must give any other recipients of the Work or Derivative Works a copy of this License; and</p>
                            <p>(b) You must cause any modified files to carry prominent notices stating that You changed the files; and</p>
                            <p>(c) You must retain, in the Source form of any Derivative Works that You distribute, all copyright, patent, trademark, and attribution notices from the Source form of the Work, excluding those notices that do not pertain to any part of the Derivative Works; and</p>
                            <p>(d) If the Work includes a &quot;NOTICE&quot; text file as part of its distribution, then any Derivative Works that You distribute must include a readable copy of the attribution notices contained within such NOTICE file, excluding those notices that do not pertain to any part of the Derivative Works, in at least one of the following places: within a NOTICE text file distributed as part of the Derivative Works; within the Source form or documentation, if provided along with the Derivative Works; or, within a display generated by the Derivative Works, if and wherever such third-party notices normally appear. The contents of the NOTICE file are for informational purposes only and do not modify the License. You may add Your own attribution notices within Derivative Works that You distribute, alongside or as an addendum to the NOTICE text from the Work, provided that such additional attribution notices cannot be construed as modifying the License.</p>
                            <p>You may add Your own copyright statement to Your modifications and may provide additional or different license terms and conditions for use, reproduction, or distribution of Your modifications, or for any such Derivative Works as a whole, provided Your use, reproduction, and distribution of the Work otherwise complies with the conditions stated in this License.</p>
                            <br />
                            <p>5. Submission of Contributions. Unless You explicitly state otherwise, any Contribution intentionally submitted for inclusion in the Work by You to the Licensor shall be under the terms and conditions of this License, without any additional terms or conditions. Notwithstanding the above, nothing herein shall supersede or modify the terms of any separate license agreement you may have executed with Licensor regarding such Contributions.</p>
                            <br />
                            <p>6. Trademarks. This License does not grant permission to use the trade names, trademarks, service marks, or product names of the Licensor, except as required for reasonable and customary use in describing the origin of the Work and reproducing the content of the NOTICE file.</p>
                            <br />
                            <p>7. Disclaimer of Warranty. Unless required by applicable law or agreed to in writing, Licensor provides the Work (and each Contributor provides its Contributions) on an &quot;AS IS&quot; BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied, including, without limitation, any warranties or conditions of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A PARTICULAR PURPOSE. You are solely responsible for determining the appropriateness of using or redistributing the Work and assume any risks associated with Your exercise of permissions under this License.</p>
                            <br />
                            <p>8. Limitation of Liability. In no event and under no legal theory, whether in tort (including negligence), contract, or otherwise, unless required by applicable law (such as deliberate and grossly negligent acts) or agreed to in writing, shall any Contributor be liable to You for damages, including any direct, indirect, special, incidental, or consequential damages of any character arising as a result of this License or out of the use or inability to use the Work (including but not limited to damages for loss of goodwill, work stoppage, computer failure or malfunction, or any and all other commercial damages or losses), even if such Contributor has been advised of the possibility of such damages.</p>
                            <br />
                            <p>9. Accepting Warranty or Additional Liability. While redistributing the Work or Derivative Works thereof, You may choose to offer, and charge a fee for, acceptance of support, warranty, indemnity, or other liability obligations and/or rights consistent with this License. However, in accepting such obligations, You may act only on Your own behalf and on Your sole responsibility, not on behalf of any other Contributor, and only if You agree to indemnify, defend, and hold each Contributor harmless for any liability incurred by, or claims asserted against, such Contributor by reason of your accepting any such warranty or additional liability.</p>
                        </div>
                    </div>
                    <div className="license-section">
                        <div className="license-section-title">
                            <i className="fas fa-file-contract"></i>
                            ZXing Browser
                        </div>
                        <div className="license-section-body">
                            <p>Copyright (c) 2018 ZXing for JS</p>
                            <p><strong>License: MIT License</strong></p>
                            <p>Licensed under the MIT License (the &quot;License&quot;); you may not use this file except in compliance with the License. You may obtain a copy of the License at:</p>
                            <p>
                                <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer">
                                    https://opensource.org/licenses/MIT
                                </a>
                            </p>
                            <br />
                            <p className="license-disclaimer">Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an &quot;AS IS&quot; BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.</p>
                            <br />
                            <p className="license-usage-description">
                                <strong>Application Usage:</strong> This project integrates the ZXing library to enable mobile/web camera scanning capabilities. It detects and analyzes barcodes (such as EAN/UPC) on product labels and automatically cross-references the retrieved barcode information with the Open Food Facts database to fetch detailed product and nutritional information.
                            </p>
                        </div>
                    </div>
                    <div className="license-section">
                        <div className="license-section-title">
                            <i className="fas fa-file-contract"></i>
                            Google Fonts (DM Sans)
                        </div>
                        <div className="license-section-body">
                            <p><strong>Font: DM Sans</strong></p>
                            <p>Copyright 2014-2018 Indian Type Foundry (<a href="mailto:info@indiantypefoundry.com" target="_blank">info@indiantypefoundry.com</a>)</p>
                            <p>Copyright 2019 Google LLC</p>
                            <br />
                            <p><strong>License: SIL Open Font License, Version 1.1</strong></p>
                            <p>This Font Software is licensed under the SIL Open Font License, Version 1.1.</p>
                            <p>This license is available with a FAQ at: <a href="https://scripts.sil.org/OFL" target="_blank">https://scripts.sil.org/OFL</a></p>
                            <br />
                            <p><strong>PREAMBLE</strong></p>
                            <p>The goals of the Open Font License (OFL) are to stimulate worldwide development of collaborative font projects, to support the font creation efforts of academic and linguistic communities, and to provide a free and open framework in which fonts may be shared and improved in partnership with others.</p>
                            <br />
                            <p><strong>PERMISSION & CONDITIONS</strong></p>
                            <p>Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions:</p>
                            <p>1. Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself.</p>
                            <p>2. Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license.</p>
                            <p>3. No Modified Version of the Font Software may use the Reserved Font Name(s) unless explicit written permission is granted by the corresponding Copyright Holder.</p>
                            <p>4. The name(s) of the Copyright Holder(s) or the Author(s) of the Font Software shall not be used to promote, endorse or advertise any Modified Version, except to acknowledge the contribution(s) of the Copyright Holder(s) and the Author(s) or with their explicit written permission.</p>
                            <p>5. The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license, and must not be distributed under any other license.</p>
                            <br />
                            <p><strong>TERMINATION</strong></p>
                            <p>This license becomes null and void if any of the above conditions are not met.</p>
                            <br />
                            <p><strong>DISCLAIMER</strong></p>
                            <p>THE FONT SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.</p>
                        </div>
                    </div>
                    <div className="license-section">
                        <div className="license-section-title">
                            <i className="fas fa-file-contract"></i>
                            Google Material Icons
                        </div>
                        <div className="license-section-body">
                            <p><strong>Material Symbols and Icons</strong></p>
                            <p>Copyright Google LLC</p>
                            <br />
                            <p><strong>License: Apache License 2.0</strong></p>
                            <p>Licensed under the Apache License, Version 2.0 (the &quot;License&quot;);</p>
                            <p>you may not use this file except in compliance with the License.</p>
                            <p>You may obtain a copy of the License at:</p>
                            <p><a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank">https://www.apache.org/licenses/LICENSE-2.0</a></p>
                            <br />
                            <p>Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an &quot;AS IS&quot; BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.</p>
                            <p>See the License for the specific language governing permissions and limitations under the License.</p>
                            <br />
                            <p><strong>About Material Icons</strong></p>
                            <p>Material Symbols are a collection of variable icon fonts developed by Google. These icons follow Material Design guidelines and are available in multiple styles (Outlined, Filled, Rounded, Sharp, Two-tone).</p>
                            <p>The icons are designed to be consistent, flexible, and easy to use across different platforms and screen sizes.</p>
                            <br />
                            <p><strong>Usage</strong></p>
                            <p>Material Icons can be used freely in both personal and commercial projects under the terms of the Apache License 2.0.</p>
                            <p>Attribution is not required but appreciated.</p>
                        </div>
                    </div>
                    <div className="license-section">
                        <div className="license-section-title">
                            <i className="fas fa-file-contract"></i>
                            About Your Hydration Goal
                        </div>
                        <div className="license-section-body">
                            <p>Please note: The displayed values are for informational purposes only and are calculated based on standardized algorithms and general health guidelines. These calculations serve as approximate guidelines and should not be considered as definitive medical advice.</p>
                            <p>Individual hydration needs can vary significantly based on multiple factors including but not limited to: body weight, height, physical activity level, age, gender, climate conditions, medical conditions, medications, and overall health status. Environmental factors such as temperature, humidity, and altitude may also affect daily fluid requirements.</p>
                            <p>The provided values represent statistical averages and may need adjustment based on your specific circumstances. For personalized hydration recommendations, especially if you have underlying health conditions or specific dietary requirements, please consult with a qualified healthcare provider or registered dietitian.</p>
                            <p>Use is at your own risk. No liability is accepted for damage to health that may arise from errors in the calculation.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
