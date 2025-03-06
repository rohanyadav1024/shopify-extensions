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
} from "@shopify/ui-extensions-react/admin";
import { Heading } from "@shopify/ui-extensions/admin";
import { useEffect, useState } from "react";

const TARGET = "admin.draft-order-details.block.render";

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data, query } = useApi(TARGET);
  const [items, setItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState(["none"]);
  const [loading, setLoading] = useState(true);
  const [giftWrapOption, setGiftWrapOption] = useState("Gift Wrap Items Together");
  const [giftWrapForWrappingTogether, setGiftWrapForWrappingTogether] = useState("With Love");
  const [giftNote, setGiftNote] = useState("");
  const [draftOrderCustomAttributes, setDraftOrderCustomAttributes] = useState([]);

  const giftWrapOptions = [
    { value: "Gift Wrap Items Together", label: "Together" },
    { value: "Gift Wrap Items Separately", label: "Separate" }];

  const wrapperOptions = [
    { value: "Holiday", label: "Holiday" },
    { value: "With Love", label: "With Love" }];

  const draftOrderId = data?.selected[0]?.id;

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
                  variant {
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
        const response = await query(QUERY, { variables: { draftOrderId } });
        const draftOrder = response?.data?.draftOrder;

        if (draftOrder) {
          setGiftNote(draftOrder.note2 || "");
          setGiftWrapOption(
            draftOrder.customAttributes?.find((attr) => attr.key === "Gift Wrap Option")?.value || "Gift Wrap Items Together");
          
          setGiftWrapForWrappingTogether(
            draftOrder.customAttributes?.find((attr) => attr.key === "Gift Wrap")?.value || "With Love");

          setDraftOrderCustomAttributes(draftOrder.customAttributes || []);

          const lineItems = draftOrder.lineItems.edges.map(({ node }) => {
            const giftWrapAttr = node.customAttributes?.find((attr) => attr.key === "Gift Wrap");
            return {
              id: node.id,
              name: node.name || node.title,
              selected: !!giftWrapAttr,
              variantId: node.variant?.id,
              quantity: node.quantity,
              wrapOption: giftWrapAttr?.value || "With Love",
              customAttributes: node.customAttributes || []};
          });

          const selectedIds = lineItems.filter((item) => item.selected).map((item) => item.id.toString());

          setItems(lineItems);
          setSelectedItemIds(selectedIds);
        }
      } finally {
        setLoading(false);
      }
    }
  }

  const updateDraftOrderAttributes = (existingAttributes, key, value, action) => {
    const filteredAttributes = existingAttributes.filter((attr) => attr.key !== key);

    return action === "add" ? [...filteredAttributes, { key, value }] : filteredAttributes; // No addition on remove
  };

  const updateCustomAttributes = (attributes = [], isSelected, wrapOption, action) => {
    const filteredAttributes = attributes.filter((attr) => attr.key !== "Gift Wrap");

    return isSelected && action === "add"
      ? [...filteredAttributes, { key: "Gift Wrap", value: wrapOption }]
      : filteredAttributes; // Preserve others even when removing gift wrap
  };

  async function updateDraftOrder(draftOrderId, lineItems, giftWrapOption, draftOrderCustomAttributes, action) {
    const MUTATION = `
      mutation updateDraftOrder($input: DraftOrderInput!, $ownerId: ID!) {
        draftOrderUpdate(input: $input, id: $ownerId) {
          draftOrder { id }
          userErrors { message field }
        }
      }
    `;

    const input = {
      note: action === "add" ? giftNote : null,
      customAttributes: updateDraftOrderAttributes(draftOrderCustomAttributes,"Gift Wrap Option",giftWrapOption,action),  // Pass fetched attributes here
      lineItems: lineItems.map(({ id, quantity, variantId, selected, wrapOption, customAttributes}) => ({
          uuid: id,
          variantId,
          quantity,
          customAttributes: updateCustomAttributes(customAttributes, selected, wrapOption, action)
        })
      ),
    };

    await query(MUTATION, { variables: { input, ownerId: draftOrderId } });
    await fetchDraftOrderItems();
  }

  const itemSelection = (selectedIds) => {
    setSelectedItemIds(selectedIds);
    setItems((prevItems) =>
      prevItems.map((item) => ({
        ...item,
        selected: selectedIds.includes(item.id),
        wrapOption:
          selectedIds.includes(item.id) &&
          giftWrapOption === "Gift Wrap Items Together"
            ? giftWrapForWrappingTogether
            : item.wrapOption,
      }))
    );
  };

  const wrapSelection = (id, option) => {
    setItems((prevItems) =>
      prevItems.map((item) => item.id === id ? { ...item, wrapOption: option } : item));
  };

  const giftWrapForWrappingTogetherChange = (value) => {
    setGiftWrapForWrappingTogether(value);
    setItems((prevItems) =>
      prevItems.map((item) => ({
        ...item,
        wrapOption:
          item.selected && giftWrapOption === "Gift Wrap Items Together"
            ? value
            : item.wrapOption,
      }))
    );
  };

  async function addGiftWrap() {
    await updateDraftOrder(draftOrderId, items, giftWrapOption, draftOrderCustomAttributes, "add");
  }

  async function removeGiftWrap() {
    // setGiftNote()
    await updateDraftOrder(draftOrderId, items, "", draftOrderCustomAttributes, "remove");
  }

  return (
    <AdminBlock title="Gift wrap">
      <BlockStack blockGap="base" padding="base" blockSize="50%">
        <Heading size="4">Select items to wrap</Heading>
        <ChoiceList
          choices={items.map((item) => ({
            label: item.name,
            id: item.id.toString(),
          }))}
          multiple="true"
          value={selectedItemIds}
          onChange={itemSelection}
        />
        <Select
          label="Gift wrap together?"
          options={giftWrapOptions}
          value={giftWrapOption}
          onChange={setGiftWrapOption}
        />
        {giftWrapOption === "Gift Wrap Items Together" ? (
          <Select
            label="Select gift wrap"
            options={wrapperOptions}
            value={giftWrapForWrappingTogether}
            onChange={giftWrapForWrappingTogetherChange}
          />
        ) : (
          <BlockStack>
            <Heading size="4">Select gift wrap</Heading>
            {items.map(
              (item) =>
                item.selected && (
                  <BlockStack key={item.id} padding="base none">
                    <Select
                      label={item.name}
                      options={wrapperOptions}
                      value={item.wrapOption}
                      onChange={(value) => wrapSelection(item.id, value)}
                    />
                  </BlockStack>
                )
            )}
          </BlockStack>
        )}
        <TextArea
          label="Gift Note"
          placeholder="Add an optional gift note"
          value={giftNote}
          onChange={setGiftNote}
          rows="5"
        />
        <Text fontStyle="italic">
          Gift notes are printed in cursive font and applied to the gift
          wrapping.
        </Text>
        <InlineStack spacing="tight" columnGap="base" inlineAlignment="end">
          <Button variant="secondary" onPress={removeGiftWrap}>
            Remove Gift Wrap
          </Button>
          <Button variant="primary" onPress={addGiftWrap}>
            Confirm Gift Wrapping
          </Button>
        </InlineStack>
      </BlockStack>
    </AdminBlock>
  );
}
