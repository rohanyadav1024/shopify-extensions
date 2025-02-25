
// Working Code with error of line items inconsistency
// async function updateDraftOrder(draftOrderId, lineItems, giftNote, giftWrapOption, action) {
//   const MUTATION = `
//     mutation updateDraftOrder($input: DraftOrderInput!, $ownerId: ID!) {
//       draftOrderUpdate(input: $input, id: $ownerId) {
//         draftOrder { id }
//         userErrors { message field }
//       }
//     }
//   `;

//   const input = action === "add" 
//     ? {
//         // note: giftNote || "No gift note provided",
//         note: giftNote || "",
//         customAttributes: [{ key: "giftWrappingOption", value: giftWrapOption || "None" }],
//         lineItems: lineItems.map(({ uuid,quantity, name,variantId, wrapOption }) => ({
//           uuid: uuid,
//           quantity: quantity,
//           variantId: variantId,
//           customAttributes: [{ key: "giftWrapOption", value: wrapOption || "None" }]
//           // title: name,
//         }))
//       } 
//     : {
//         note: "", // Remove gift note
//         customAttributes: [], // Remove draft order-level custom attributes
//         lineItems: lineItems.map(({ uuid,quantity, name,variantId }) => ({
//           uuid: uuid,
//           variantId: variantId,
//           // title: name,
//           quantity: quantity,
//           customAttributes: [] // Remove line-item-level custom attributes
//         }))
//       };

//   // console.log(`${action === "add" ? "Adding" : "Removing"} Gift Wrap - Input:`, JSON.stringify(input, null, 2));

//   try {
//     const response = await query(MUTATION, { variables: { input, ownerId: draftOrderId } });
//     console.log("Mutation Response:", JSON.stringify(response, null, 2));

//     if (response.errors) {
//       console.error("GraphQL Errors:", response.errors);
//     }
//     if (response.data?.draftOrderUpdate?.userErrors.length > 0) {
//       console.error("User Errors:", response.data.draftOrderUpdate.userErrors);
//     }

//     await fetchDraftOrderItems();

//   } catch (error) {
//     console.error("Mutation Failed:", error);
//   }
// }


// for setting selected items
  useEffect(() => {
    setSelectedItems();
    console.log("Selected Items IDs after fetch:", selectedItemIds);
  }, [items])

  async function setSelectedItems() {
    const selectedIds = items.filter(item => item.selected).map(item => String(item.id));
    setSelectedItemIds(() => [...selectedIds]);
  }


//   Code with logs : 25/02, 2:15pm

import {
    reactExtension,
    useApi,
    AdminBlock,
    BlockStack,
    Text,
    Select,
    Button,
    InlineStack,
    ChoiceList,
    TextArea,
  } from '@shopify/ui-extensions-react/admin';
  import { Heading, Section } from '@shopify/ui-extensions/admin';
  import Head from 'next/head';
  import { useEffect, useState } from 'react';
  
  const TARGET = 'admin.draft-order-details.block.render';
  
  export default reactExtension(TARGET, () => <App />);
  
  
  
  function App() {
    // const { query, data } = useApi(TARGET);
    const {data, query} = useApi(TARGET);
    const [items, setItems] = useState([]);
    const [selectedItemIds, setSelectedItemIds] = useState(['none']);
    const [loading, setLoading] = useState(true);
    const [wrapTogether, setWrapTogether] = useState('together');
    const [giftNote, setGiftNote] = useState("");
  
  
    const draftOrderId = data?.selected[0]?.id;
    // Fetch Draft Order items dynamically
    useEffect(() => {
      fetchDraftOrderItems();
    }, [data]);
  
  
    async function fetchDraftOrderItems() {
      if (draftOrderId) {
        const QUERY = `
          query getDraftOrderItems($draftOrderId: ID!) {
            draftOrder(id: $draftOrderId) {
              id
              customAttributes {
                key
                value
              }
              note2
              lineItems(first: 10) {
                edges {
                  node {
                    id
                    name
                    title
                    quantity
                    variant{
                      id
                    }
                    customAttributes {
                      key
                      value
                    }
                  }
                }
              }
            }
          }
        `;
  
        try {
          console.log('API calling started')
          const response = await query(QUERY, {variables: { draftOrderId: draftOrderId}  });
  
          console.log('RESTPONSE' , response?.data);
          console.log('API calling finsih')
  
          const draftOrder = response?.data?.draftOrder;
  
          if (draftOrder) {
            setGiftNote(draftOrder.note2 || "");
            setWrapTogether(draftOrder.customAttributes?.find(attr => attr.key === "giftWrappingOption")?.value || "together");
  
            const lineItems = draftOrder.lineItems.edges.map(({ node }) => {
              const giftWrapAttr = node.customAttributes?.find(attr => attr.key === "giftWrapOption");
              console.log('gift wrap attribute' , giftWrapAttr);
              
              return {
                id: node.id,
                name: node.name || node.title,
                selected: giftWrapAttr ? true : false,
                variantId: node.variant?.id,
                quantity: node.quantity,
                wrapOption: giftWrapAttr?.value || "holiday",
              };
            });
  
            // console.log('line items' , lineItems);
            const selectedIds = lineItems.filter(item => item.selected).map(item => item.id.toString());
  
      // ✅ Set both items and selectedItemIds in a single state update
            setItems(lineItems);
            setSelectedItemIds(selectedIds);
          }
  
  
        } catch (error) {
          // console.error('Error fetching draft order items:', error);
        } finally {
          setLoading(false);
        }
      }
    }
  
    async function updateDraftOrder(draftOrderId, lineItems, giftNote, giftWrapOption, action) {
      const MUTATION = `
        mutation updateDraftOrder($input: DraftOrderInput!, $ownerId: ID!) {
          draftOrderUpdate(input: $input, id: $ownerId) {
            draftOrder { id }
            userErrors { message field }
          }
        }
      `;
    
      // Helper: Update or add giftWrapOption while preserving other customAttributes
      const updateCustomAttributes = (attributes = [], isSelected, wrapOption) => {
        const filteredAttributes = attributes.filter(attr => attr.key !== "giftWrapOption"); // Remove existing giftWrapOption
    
        return isSelected
          ? [...filteredAttributes, { key: "giftWrapOption", value: wrapOption }] 
          : filteredAttributes;                                                    
      };
    
      // 🛠️ Prepare line items for mutation
      const updatedLineItems = lineItems.map(({ id, quantity, variantId, selected, wrapOption, customAttributes }) => ({
        uuid: id,
        variantId: variantId,             
        quantity: quantity,               
        customAttributes: updateCustomAttributes(customAttributes, selected, wrapOption)
      }));
    
      const input = {
        note: action === "add" ? giftNote : null, 
        customAttributes: action === "add" ? [{ key: "giftWrappingOption", value: giftWrapOption }] : [],
        lineItems: updatedLineItems,              
      };
    
      // console.log(`Mutation Input (${action}):`, JSON.stringify(input, null, 2));
    
      try {
        const response = await query(MUTATION, { variables: { input, ownerId: draftOrderId } });
        // console.log("Mutation Response:", JSON.stringify(response, null, 2));
    
        // if (response.data?.draftOrderUpdate?.userErrors?.length > 0) {
        //   console.error("User Errors:", response.data.draftOrderUpdate.userErrors);
        // }
    
        await fetchDraftOrderItems();  
    
      } catch (error) {
        // console.error("Mutation Failed:", error);
      }
    }
  
    const handleItemSelection = (selectedIds) => {
      setSelectedItemIds(selectedIds);
      setItems((prevItems) =>
        prevItems.map((item) => ({
          ...item,
          selected: selectedIds.includes(item.id),
        }))
      );
    };
  
    // Handle wrap selection change
    const handleWrapSelection = (id, option) => {
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id ? { ...item, wrapOption: option } : item
        )
      );
    };
  
    async function handleAddGiftWrap() {
      // console.log("Updating Draft Order - Adding Gift Wrap...");
      
      // working code line 
      // const selectedItems = items.filter(item => item.selected);
      // await updateDraftOrder(draftOrderId, selectedItems, giftNote, wrapTogether, "add");
  
      // new changes
      await updateDraftOrder(draftOrderId, items, giftNote, wrapTogether, "add");
    }
    
    // Handler to remove gift wrap data
    async function handleRemoveGiftWrap() {
      // console.log("Updating Draft Order - Removing Gift Wrap...");
      await updateDraftOrder(draftOrderId, items, "", "", "remove");
  
      // await fetchDraftOrderItems();
    }
  
    return (
      <AdminBlock title="Gift wrap">
        <BlockStack blockGap="base" padding="base" blockSize="50%">
          <Heading size="4" >Select items to wrap</Heading>
  
          <ChoiceList
            choices={
              items.map((item) => ({
                label: item.name,  // Display product name as label
                id: item.id.toString()       // Use item ID for choice ID
              }))}
            multiple='true'
            // defaultValue={selectedItemIds}
            value={selectedItemIds}
            onChange={handleItemSelection}
            />
  
          {/* Gift wrap together selection */}
          <Select
            label="Gift wrap together?"
            options={[
              { value: 'together', label: 'Together' },
              { value: 'separate', label: 'Separate' },
            ]}
            
            value={wrapTogether}
            onChange={setWrapTogether}
          />
  
          {wrapTogether === 'together' ? (
            <Select
              label="Select gift wrap"
              options={[
                { value: 'holiday', label: 'Holiday' },
                { value: 'withlove', label: 'With Love' }
              ]}
              value="holiday"
            />
          ) : (
            <BlockStack>
              <Heading size="4">Select gift wrap</Heading>
              {items.map(
              (item) =>
                item.selected && (
                  <BlockStack key={item.id} padding="base none">
                    {/* <Text fontWeight="bold">{item.name}</Text> */}
                    <Select
                      // label="Select gift wrap"
                      label={item.name}
                      options={[
                        { value: 'holiday', label: 'Holiday' },
                        { value: 'withlove', label: 'With Love' }
                      ]}
                      value={item.wrapOption}
                      onChange={(value) => handleWrapSelection(item.id, value)}
                    />
                  </BlockStack>
                )
            )}
            </BlockStack>
          )}
  
          <TextArea label="Gift Note" placeholder="Add an optional gift note" value={giftNote}
            onChange={setGiftNote} rows="5"/>
  
          <Text fontStyle="italic">Gift notes are printed in cursive font and applied to the gift wrapping.</Text>
  
          <InlineStack spacing="tight" columnGap="base" inlineAlignment="end">
            <Button variant="secondary" onPress={handleRemoveGiftWrap}>Remove Gift Wrap</Button>
            <Button variant="primary" 
            onPress={handleAddGiftWrap}
            >Confirm Gift Wrapping</Button>
          </InlineStack>
        </BlockStack>
      </AdminBlock>
    );
  }



// Correct code without logs before changing variable and values acc to OMS requirements

// import {
//   reactExtension,
//   useApi,
//   AdminBlock,
//   BlockStack,
//   Text,
//   Select,
//   Button,
//   InlineStack,
//   ChoiceList,
//   TextArea,
// } from "@shopify/ui-extensions-react/admin";
// import { Heading, Section } from "@shopify/ui-extensions/admin";
// import Head from "next/head";
// import { useEffect, useState } from "react";

// const TARGET = "admin.draft-order-details.block.render";

// export default reactExtension(TARGET, () => <App />);

// function App() {
//   const { data, query } = useApi(TARGET);
//   const [items, setItems] = useState([]);
//   const [selectedItemIds, setSelectedItemIds] = useState(["none"]);
//   const [loading, setLoading] = useState(true);
//   // const [wrapTogether, setWrapTogether] = useState("together");
//   // const [togetherWrapOption, setTogetherWrapOption] = useState("holiday"); // Default value
//   const [giftNote, setGiftNote] = useState("");
//   // const giftWrapOptions = [
//   //   { value: "holiday", label: "Holiday" },
//   //   { value: "withlove", label: "With Love" },
//   // ];

//   const [giftWrapOption, setGiftWrapOption] = useState("Gift Wrap Items Together"); // was wrapTogether
// const [giftWrapForWrappingTogether, setGiftWrapForWrappingTogether] = useState("Holiday"); // was togetherWrapOption
// const giftWrappers = [
//   { value: "Holiday", label: "Holiday" },
//   { value: "With Love", label: "With Love" },
// ]; // was giftWrapOptions

//   const draftOrderId = data?.selected[0]?.id;
//   useEffect(() => {
//     fetchDraftOrderItems();
//   }, [data]);

//   async function fetchDraftOrderItems() {
//     if (draftOrderId) {
//       const QUERY = `
//         query getDraftOrderItems($draftOrderId: ID!) {
//           draftOrder(id: $draftOrderId) {
//             id
//             customAttributes {
//               key
//               value
//             }
//             note2
//             lineItems(first: 10) {
//               edges {
//                 node {
//                   id
//                   name
//                   title
//                   quantity
//                   variant{
//                     id
//                   }
//                   customAttributes {
//                     key
//                     value
//                   }
//                 }
//               }
//             }
//           }
//         }
//       `;

//       try {
//         const response = await query(QUERY, {
//           variables: { draftOrderId: draftOrderId },
//         });
//         const draftOrder = response?.data?.draftOrder;

//         if (draftOrder) {
//           setGiftNote(draftOrder.note2 || "");
//           // setWrapTogether(
//           //   draftOrder.customAttributes?.find(
//           //     (attr) => attr.key === "giftWrappingOption"
//           //   )?.value || "together"
//           // );

//           setGiftWrapOption(
//             draftOrder.customAttributes?.find(attr => attr.key === "Gift Wrap Option")?.value 
//             || "Gift Wrap Items Together"
//           );
          
//           setGiftWrapForWrappingTogether(
//             draftOrder.customAttributes?.find(attr => attr.key === "Gift Wrap")?.value 
//             || "Holiday"
//           );

//           const lineItems = draftOrder.lineItems.edges.map(({ node }) => {
//             const giftWrapAttr = node.customAttributes?.find(
//               (attr) => attr.key === "Gift Wrap"
//             );
//             return {
//               id: node.id,
//               name: node.name || node.title,
//               selected: giftWrapAttr ? true : false,
//               variantId: node.variant?.id,
//               quantity: node.quantity,
//               wrapOption: giftWrapAttr?.value || "Holiday",
//             };
//           });

//           const selectedIds = lineItems
//             .filter((item) => item.selected)
//             .map((item) => item.id.toString());

//           setItems(lineItems);
//           setSelectedItemIds(selectedIds);
//           // setTogetherWrapOption(draftOrder.customAttributes?.find((attr) => attr === 'giftWrappingOption')?.value || 'holiday');
//         }
//       } catch (error) {
//       } finally {
//         setLoading(false);
//       }
//     }
//   }

//   async function updateDraftOrder(
//     draftOrderId,
//     lineItems,
//     giftNote,
//     giftWrapOption,
//     action
//   ) {
//     const MUTATION = `
//       mutation updateDraftOrder($input: DraftOrderInput!, $ownerId: ID!) {
//         draftOrderUpdate(input: $input, id: $ownerId) {
//           draftOrder { id }
//           userErrors { message field }
//         }
//       }
//     `;

//     // const updateCustomAttributes = (
//     //   attributes = [],
//     //   isSelected,
//     //   wrapOption
//     // ) => {
//     //   const filteredAttributes = attributes.filter(
//     //     (attr) => attr.key !== "giftWrapOption"
//     //   ); // Remove existing giftWrapOption

//     //   return isSelected
//     //     ? [...filteredAttributes, { key: "giftWrapOption", value: wrapOption }]
//     //     : filteredAttributes;
//     // };

//     const updateCustomAttributes = (
//       attributes = [],
//       isSelected,
//       wrapOption
//     ) => {
//       const filteredAttributes = attributes.filter(
//         (attr) => attr.key !== "Gift Wrap"
//       ); // Remove existing giftWrapOption

//       return isSelected
//         ? [...filteredAttributes, { key: "Gift Wrap", value: wrapOption }]
//         : filteredAttributes;
//     };

//     const updatedLineItems = lineItems.map(
//       ({
//         id,
//         quantity,
//         variantId,
//         selected,
//         wrapOption,
//         customAttributes,
//       }) => ({
//         uuid: id,
//         variantId: variantId,
//         quantity: quantity,
//         customAttributes: updateCustomAttributes(
//           customAttributes,
//           selected,
//           wrapOption
//         ),
//       })
//     );

//     // const input = {
//     //   note: action === "add" ? giftNote : null,
//     //   customAttributes:
//     //     action === "add"
//     //       ? [{ key: "giftWrappingOption", value: giftWrapOption }]
//     //       : [],
//     //   lineItems: updatedLineItems,
//     // };
//     const input = {
//       note: action === "add" ? giftNote : null,
//       customAttributes:
//         action === "add"
//           ? [{ key: "Gift Wrap Option", value: giftWrapOption }]
//           : [],
//       lineItems: updatedLineItems,
//     };

//     try {
//       await query(MUTATION, { variables: { input, ownerId: draftOrderId } });
//       await fetchDraftOrderItems();
//     } catch (error) {}
//   }

//   const handleItemSelection = (selectedIds) => {
//     setSelectedItemIds(selectedIds);
//     setItems((prevItems) =>
//       prevItems.map((item) => ({
//         ...item,
//         selected: selectedIds.includes(item.id),
//         // wrapOption: selectedIds.includes(item.id) && wrapTogether === 'together' ? togetherWrapOption : item.wrapOption,
//         wrapOption: selectedIds.includes(item.id) && giftWrapOption === 'Gift Wrap Items Together' ? giftWrapForWrappingTogether : item.wrapOption,
//       }))
//     );
//   };

//   // Handle wrap selection change
//   const handleWrapSelection = (id, option) => {
//     setItems((prevItems) =>
//       prevItems.map((item) =>
//         item.id === id ? { ...item, wrapOption: option } : item
//       )
//     );
//   };

//   const handleTogetherWrapOptionChange = (value) => {
//     // setTogetherWrapOption(value); // Update global wrap option
//     setGiftWrapForWrappingTogether(value); // Update global wrap option
  
//     setItems((prevItems) =>
//       prevItems.map((item) => ({
//         ...item,
//         // wrapOption: item.selected && wrapTogether === "together" ? value : item.wrapOption,
//         wrapOption: item.selected && giftWrapOption === "Gift Wrap Items Together" ? value : item.wrapOption,
//       }))
//     );
//   };

//   async function handleAddGiftWrap() {
//     await updateDraftOrder(draftOrderId, items, giftNote, giftWrapOption, "add");
//   }

//   // Handler to remove gift wrap data
//   async function handleRemoveGiftWrap() {
//     await updateDraftOrder(draftOrderId, items, "", "", "remove");
//   }

//   return (
//     <AdminBlock title="Gift wrap">
//       <BlockStack blockGap="base" padding="base" blockSize="50%">
//         <Heading size="4">Select items to wrap</Heading>

//         <ChoiceList
//           choices={items.map((item) => ({
//             label: item.name, // Display product name as label
//             id: item.id.toString(), // Use item ID for choice ID
//           }))}
//           multiple="true"
//           value={selectedItemIds}
//           onChange={handleItemSelection}
//         />

//         <Select
//           label="Gift wrap together?"
//           options={[
//             { value: "Gift Wrap Items Together", label: "Together" },
//     { value: "Gift Wrap Items Separately", label: "Separate" }
//           ]}
//           // options={[
//           //   { value: "together", label: "Together" },
//           //   { value: "separate", label: "Separate" },
//           // ]}
//           value={wrapTogether}
//           onChange={setWrapTogether}
//         />

//         {/* {wrapTogether === "together" ? (
//           <Select
//             label="Select gift wrap"
//             options={giftWrapOptions}
//             value={togetherWrapOption}
//             onChange={handleTogetherWrapOptionChange}
//           />
//         ) : (
//           <BlockStack>
//             <Heading size="4">Select gift wrap</Heading>
//             {items.map(
//               (item) =>
//                 item.selected && (
//                   <BlockStack key={item.id} padding="base none">
//                     <Select
//                       label={item.name}
//                       options={giftWrapOptions}
//                       value={item.wrapOption}
//                       onChange={(value) => handleWrapSelection(item.id, value)}
//                     />
//                   </BlockStack>
//                 )
//             )}
//           </BlockStack>
//         )} */}

// {giftWrapOption === "Gift Wrap Items Together" ? (
//   <Select
//     label="Select gift wrap"
//     options={giftWrappers}
//     value={giftWrapForWrappingTogether}
//     onChange={handleGiftWrapForWrappingTogetherChange}
//   />
// ) : (
//   <BlockStack>
//     <Heading size="4">Select gift wrap</Heading>
//     {items.map(
//       (item) =>
//         item.selected && (
//           <BlockStack key={item.id} padding="base none">
//             <Select
//               label={item.name}
//               options={giftWrappers}
//               value={item.wrapOption}
//               onChange={(value) => handleWrapSelection(item.id, value)}
//             />
//           </BlockStack>
//         )
//     )}
//   </BlockStack>
// )}

//         <TextArea
//           label="Gift Note"
//           placeholder="Add an optional gift note"
//           value={giftNote}
//           onChange={setGiftNote}
//           rows="5"
//         />

//         <Text fontStyle="italic">
//           Gift notes are printed in cursive font and applied to the gift
//           wrapping.
//         </Text>

//         <InlineStack spacing="tight" columnGap="base" inlineAlignment="end">
//           <Button variant="secondary" onPress={handleRemoveGiftWrap}>
//             Remove Gift Wrap
//           </Button>
//           <Button variant="primary" onPress={handleAddGiftWrap}>
//             Confirm Gift Wrapping
//           </Button>
//         </InlineStack>
//       </BlockStack>
//     </AdminBlock>
//   );
// }
