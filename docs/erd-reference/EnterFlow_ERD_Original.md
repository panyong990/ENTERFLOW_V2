# Enter-Flow ERD — Attributes, PK/FK, and Cardinalities

## client

* client\_id **(PK)**
* company\_name **(UQ)**
* industry
* contact\_person
* phone
* email
* address\_line1
* address\_line2
* city\_province
* zip\_code
* default\_payment\_terms
* preferred\_delivery\_method\_id
* internal\_notes
* status
* client\_since
* created\_at

## client\_receipt

* receipt\_id **(PK)**
* invoice\_id **(FK → sales\_invoice.invoice\_id)**
* client\_user\_id
* document\_id
* payment\_method\_id
* amount\_declared
* note
* review\_status
* reviewed\_by\_user\_id **(FK → user\_account.user\_id)**
* reviewed\_at
* sent\_at

## client\_user

* client\_user\_id **(PK)**
* client\_id **(FK → client.client\_id; UQ)**
* email **(UQ)**
* password\_hash
* must\_change\_password
* status
* last\_login\_at
* created\_at

## cost\_estimate

* estimate\_id **(PK)**
* quotation\_item\_id **(FK → quotation\_item.quotation\_item\_id)**
* labor\_cost\_per\_unit
* include\_labor
* markup\_percent
* apply\_markup
* vat\_type
* vat\_rate
* apply\_vat
* material\_cost\_per\_unit
* unit\_cost\_with\_markup
* unit\_cost\_with\_vat
* is\_locked
* created\_by\_user\_id **(FK → user\_account.user\_id)**
* created\_at

## cost\_estimate\_material

* estimate\_material\_id **(PK)**
* estimate\_id **(FK → cost\_estimate.estimate\_id)**
* material\_category\_id
* raw\_material\_id **(FK → raw\_material.material\_id)**
* qty\_per\_filter
* uom\_id
* unit\_price\_snapshot
* line\_cost

## delivery

* delivery\_id **(PK)**
* jo\_id **(FK → job\_order.jo\_id)**
* po\_id **(FK → purchase\_order.po\_id)**
* invoice\_id
* client\_id **(FK → client.client\_id)**
* delivery\_method\_id
* dr\_no **(UQ)**
* waybill\_no **(UQ)**
* status
* dispatch\_date
* estimated\_delivery\_date
* delivered\_date
* driver\_name
* driver\_contact
* vehicle\_plate
* tracking\_link
* signed\_dr\_document\_id
* received\_by
* notes
* dispatched\_by\_user\_id **(FK → user\_account.user\_id)**
* created\_at

## delivery\_item

* delivery\_item\_id **(PK)**
* delivery\_id **(FK → delivery.delivery\_id)**
* jo\_item\_id **(FK → job\_order\_item.jo\_item\_id)**
* quantity

## finished\_good

* finished\_good\_id **(PK)**
* item\_code **(UQ)**
* enterfil\_pn
* item\_name
* client\_id
* filter\_type\_id
* qty\_in\_stock
* buffer\_min
* demand\_level
* order\_frequency
* avg\_qty\_per\_order
* is\_active

## inquiry

* inquiry\_id **(PK)**
* inquiry\_no **(UQ)**
* client\_id **(FK → client.client\_id)**
* contact\_person
* payment\_terms
* source
* submitted\_by\_client\_user\_id **(FK → client\_user.client\_user\_id)**
* created\_by\_user\_id **(FK → user\_account.user\_id)**
* general\_notes
* is\_rush
* required\_by\_date
* due\_date
* status
* rejection\_reason
* created\_at
* updated\_at

## inquiry\_item

* inquiry\_item\_id **(PK)**
* inquiry\_id **(FK → inquiry.inquiry\_id)**
* line\_no
* filter\_type\_id
* filter\_name
* oem\_reference
* od1\_mm
* od2\_mm
* id1\_mm
* id2\_mm
* height\_mm
* overall\_height\_mm
* filter\_media
* inner\_core
* outer\_core
* o\_ring
* gasket
* filtration\_rating
* filtration\_rating\_custom
* quantity
* sketch\_document\_id

## job\_order

* jo\_id **(PK)**
* jo\_no **(UQ)**
* po\_id **(FK → purchase\_order.po\_id)**
* client\_id **(FK → client.client\_id)**
* jo\_date
* due\_date
* is\_rush
* status
* payment\_terms
* delivery\_method\_id
* issue\_sales\_invoice
* po\_verified
* specs\_verified
* terms\_verified
* prepared\_by\_user\_id **(FK → user\_account.user\_id)**
* approved\_by\_user\_id **(FK → user\_account.user\_id)**
* cancellation\_reason
* completed\_at
* archived\_at
* created\_at

## job\_order\_item

* jo\_item\_id **(PK)**
* jo\_id **(FK → job\_order.jo\_id)**
* quotation\_item\_id **(FK → quotation\_item.quotation\_item\_id)**
* line\_no
* item\_code
* enterfil\_pn
* item\_name
* quantity
* od1\_mm
* od2\_mm
* id1\_mm
* id2\_mm
* height\_mm
* overall\_height\_mm
* filter\_media
* inner\_core
* outer\_core
* end\_cap
* o\_ring
* gasket
* oem\_pn
* brand
* other\_specs
* final\_sketch\_document\_id

## job\_order\_stage

* jo\_stage\_id **(PK)**
* jo\_id **(FK → job\_order.jo\_id)**
* stage\_id
* status
* started\_at
* completed\_at
* marked\_by\_user\_id **(FK → user\_account.user\_id)**
* remarks
* reverted\_count

## material\_shortage\_report

* report\_id **(PK)**
* jo\_id **(FK → job\_order.jo\_id)**
* jo\_stage\_id **(FK → job\_order\_stage.jo\_stage\_id)**
* raw\_material\_id **(FK → raw\_material.material\_id)**
* qty\_needed
* description
* status
* reported\_by\_user\_id **(FK → user\_account.user\_id)**
* reported\_at
* resolved\_at

## notification

* notification\_id **(PK)**
* user\_id **(FK → user\_account.user\_id)**
* title
* message
* notification\_type
* is\_read
* created\_at
* read\_at

## payment\_transaction

* payment\_id **(PK)**
* invoice\_id **(FK → sales\_invoice.invoice\_id)**
* payment\_method\_id
* transaction\_type
* amount
* reference\_no
* date\_paid
* client\_receipt\_id **(FK → client\_receipt.receipt\_id)**
* approval\_status
* recorded\_by\_user\_id **(FK → user\_account.user\_id)**
* approved\_by\_user\_id **(FK → user\_account.user\_id)**
* approved\_at
* notes
* created\_at

## production\_plan

* plan\_id **(PK)**
* plan\_code **(UQ)**
* client\_id **(FK → client.client\_id)**
* finished\_good\_id **(FK → finished\_good.finished\_good\_id)**
* jo\_id **(FK → job\_order.jo\_id)**
* source
* planned\_qty
* week\_start\_date
* week\_end\_date
* created\_by\_user\_id **(FK → user\_account.user\_id)**

## purchase\_order

* po\_id **(PK)**
* po\_no **(UQ)**
* inquiry\_id **(FK → inquiry.inquiry\_id)**
* quotation\_id **(FK → quotation.quotation\_id)**
* client\_id **(FK → client.client\_id)**
* po\_document\_id
* received\_date
* payment\_terms
* delivery\_method\_id
* downpayment\_required
* downpayment\_percent
* downpayment\_amount
* downpayment\_confirmed
* downpayment\_confirmed\_date
* recorded\_by\_user\_id **(FK → user\_account.user\_id)**
* created\_at

## quotation

* quotation\_id **(PK)**
* quotation\_no **(UQ)**
* inquiry\_id **(FK → inquiry.inquiry\_id)**
* revision\_no
* is\_current
* quotation\_date
* valid\_until
* terms\_of\_payment
* time\_of\_delivery
* place\_of\_delivery
* vat\_type
* highlight\_tag
* highlight\_note
* requires\_downpayment
* downpayment\_percent
* downpayment\_amount
* subtotal
* addons\_total
* total\_amount
* status
* prepared\_by\_user\_id **(FK → user\_account.user\_id)**
* approved\_by\_user\_id **(FK → user\_account.user\_id)**
* sent\_at
* created\_at

## quotation\_item

* quotation\_item\_id **(PK)**
* quotation\_id **(FK → quotation.quotation\_id)**
* inquiry\_item\_id **(FK → inquiry\_item.inquiry\_item\_id)**
* line\_no
* description
* quantity
* uom\_id
* unit\_price
* line\_total

## raw\_material

* material\_id **(PK)**
* material\_category\_id
* material\_name
* uom\_id
* qty\_in\_stock
* unit\_price
* reorder\_threshold
* supplier\_name
* is\_active
* created\_at
* updated\_at

## role

* role\_id **(PK)**
* role\_name **(UQ)**
* description
* is\_owner\_role

## sales\_invoice

* invoice\_id **(PK)**
* invoice\_no **(UQ)**
* jo\_id **(FK → job\_order.jo\_id)**
* po\_id **(FK → purchase\_order.po\_id)**
* client\_id **(FK → client.client\_id)**
* invoice\_date
* payment\_terms
* delivered\_date
* due\_date
* total\_amount
* status
* issued\_by\_user\_id **(FK → user\_account.user\_id)**
* created\_at

## stock\_movement

* movement\_id **(PK)**
* item\_type
* raw\_material\_id **(FK → raw\_material.material\_id)**
* finished\_good\_id **(FK → finished\_good.finished\_good\_id)**
* movement\_reason
* qty\_before
* qty\_after
* qty\_change
* reference\_no
* supplier\_name
* jo\_id **(FK → job\_order.jo\_id)**
* notes
* performed\_by\_user\_id **(FK → user\_account.user\_id)**
* created\_at

## user\_account

* user\_id **(PK)**
* role\_id **(FK → role.role\_id)**
* full\_name
* email **(UQ)**
* password\_hash
* initials
* phone
* status
* must\_change\_password
* joined\_date
* last\_login\_at
* created\_at

## Relationships and cardinalities

Notation: Parent → Child. The parent-side label is how many child records may reference a parent; the child-side label is how many parents a child may reference. These are SQL-derived cardinalities, not necessarily stricter business rules.

|Parent table|Child table (FK column)|Parent → Child|Child → Parent|
|-|-|-:|-:|
|`sales\_invoice` (`invoice\_id`)|`client\_receipt`.`invoice\_id`|`0..M`|`0..1`|
|`user\_account` (`user\_id`)|`client\_receipt`.`reviewed\_by\_user\_id`|`0..M`|`0..1`|
|`client` (`client\_id`)|`client\_user`.`client\_id`|`0..1`|`1`|
|`quotation\_item` (`quotation\_item\_id`)|`cost\_estimate`.`quotation\_item\_id`|`0..M`|`1`|
|`user\_account` (`user\_id`)|`cost\_estimate`.`created\_by\_user\_id`|`0..M`|`0..1`|
|`cost\_estimate` (`estimate\_id`)|`cost\_estimate\_material`.`estimate\_id`|`0..M`|`1`|
|`raw\_material` (`material\_id`)|`cost\_estimate\_material`.`raw\_material\_id`|`0..M`|`0..1`|
|`job\_order` (`jo\_id`)|`delivery`.`jo\_id`|`0..M`|`1`|
|`purchase\_order` (`po\_id`)|`delivery`.`po\_id`|`0..M`|`0..1`|
|`client` (`client\_id`)|`delivery`.`client\_id`|`0..M`|`1`|
|`user\_account` (`user\_id`)|`delivery`.`dispatched\_by\_user\_id`|`0..M`|`0..1`|
|`delivery` (`delivery\_id`)|`delivery\_item`.`delivery\_id`|`0..M`|`1`|
|`job\_order\_item` (`jo\_item\_id`)|`delivery\_item`.`jo\_item\_id`|`0..M`|`1`|
|`client` (`client\_id`)|`inquiry`.`client\_id`|`0..M`|`1`|
|`client\_user` (`client\_user\_id`)|`inquiry`.`submitted\_by\_client\_user\_id`|`0..M`|`0..1`|
|`user\_account` (`user\_id`)|`inquiry`.`created\_by\_user\_id`|`0..M`|`0..1`|
|`inquiry` (`inquiry\_id`)|`inquiry\_item`.`inquiry\_id`|`0..M`|`1`|
|`purchase\_order` (`po\_id`)|`job\_order`.`po\_id`|`0..M`|`1`|
|`client` (`client\_id`)|`job\_order`.`client\_id`|`0..M`|`1`|
|`user\_account` (`user\_id`)|`job\_order`.`prepared\_by\_user\_id`|`0..M`|`0..1`|
|`user\_account` (`user\_id`)|`job\_order`.`approved\_by\_user\_id`|`0..M`|`0..1`|
|`job\_order` (`jo\_id`)|`job\_order\_item`.`jo\_id`|`0..M`|`1`|
|`quotation\_item` (`quotation\_item\_id`)|`job\_order\_item`.`quotation\_item\_id`|`0..M`|`0..1`|
|`job\_order` (`jo\_id`)|`job\_order\_stage`.`jo\_id`|`0..M`|`1`|
|`user\_account` (`user\_id`)|`job\_order\_stage`.`marked\_by\_user\_id`|`0..M`|`0..1`|
|`job\_order` (`jo\_id`)|`material\_shortage\_report`.`jo\_id`|`0..M`|`1`|
|`job\_order\_stage` (`jo\_stage\_id`)|`material\_shortage\_report`.`jo\_stage\_id`|`0..M`|`0..1`|
|`raw\_material` (`material\_id`)|`material\_shortage\_report`.`raw\_material\_id`|`0..M`|`0..1`|
|`user\_account` (`user\_id`)|`material\_shortage\_report`.`reported\_by\_user\_id`|`0..M`|`0..1`|
|`user\_account` (`user\_id`)|`notification`.`user\_id`|`0..M`|`1`|
|`sales\_invoice` (`invoice\_id`)|`payment\_transaction`.`invoice\_id`|`0..M`|`0..1`|
|`client\_receipt` (`receipt\_id`)|`payment\_transaction`.`client\_receipt\_id`|`0..M`|`0..1`|
|`user\_account` (`user\_id`)|`payment\_transaction`.`recorded\_by\_user\_id`|`0..M`|`0..1`|
|`user\_account` (`user\_id`)|`payment\_transaction`.`approved\_by\_user\_id`|`0..M`|`0..1`|
|`job\_order` (`jo\_id`)|`production\_plan`.`jo\_id`|`0..M`|`0..1`|
|`client` (`client\_id`)|`production\_plan`.`client\_id`|`0..M`|`0..1`|
|`finished\_good` (`finished\_good\_id`)|`production\_plan`.`finished\_good\_id`|`0..M`|`0..1`|
|`user\_account` (`user\_id`)|`production\_plan`.`created\_by\_user\_id`|`0..M`|`0..1`|
|`inquiry` (`inquiry\_id`)|`purchase\_order`.`inquiry\_id`|`0..M`|`1`|
|`quotation` (`quotation\_id`)|`purchase\_order`.`quotation\_id`|`0..M`|`1`|
|`client` (`client\_id`)|`purchase\_order`.`client\_id`|`0..M`|`1`|
|`user\_account` (`user\_id`)|`purchase\_order`.`recorded\_by\_user\_id`|`0..M`|`0..1`|
|`inquiry` (`inquiry\_id`)|`quotation`.`inquiry\_id`|`0..M`|`1`|
|`user\_account` (`user\_id`)|`quotation`.`prepared\_by\_user\_id`|`0..M`|`0..1`|
|`user\_account` (`user\_id`)|`quotation`.`approved\_by\_user\_id`|`0..M`|`0..1`|
|`inquiry\_item` (`inquiry\_item\_id`)|`quotation\_item`.`inquiry\_item\_id`|`0..M`|`0..1`|
|`quotation` (`quotation\_id`)|`quotation\_item`.`quotation\_id`|`0..M`|`1`|
|`job\_order` (`jo\_id`)|`sales\_invoice`.`jo\_id`|`0..M`|`0..1`|
|`purchase\_order` (`po\_id`)|`sales\_invoice`.`po\_id`|`0..M`|`0..1`|
|`client` (`client\_id`)|`sales\_invoice`.`client\_id`|`0..M`|`1`|
|`user\_account` (`user\_id`)|`sales\_invoice`.`issued\_by\_user\_id`|`0..M`|`0..1`|
|`raw\_material` (`material\_id`)|`stock\_movement`.`raw\_material\_id`|`0..M`|`0..1`|
|`finished\_good` (`finished\_good\_id`)|`stock\_movement`.`finished\_good\_id`|`0..M`|`0..1`|
|`job\_order` (`jo\_id`)|`stock\_movement`.`jo\_id`|`0..M`|`0..1`|
|`user\_account` (`user\_id`)|`stock\_movement`.`performed\_by\_user\_id`|`0..M`|`0..1`|
|`role` (`role\_id`)|`user\_account`.`role\_id`|`0..M`|`1`|

* 

